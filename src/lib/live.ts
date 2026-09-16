/**
 * The live layer - where a read-only sealed snapshot becomes an editable app.
 *
 * The data file this dashboard ships is immutable: it is sealed on the Mac and
 * served as ciphertext from a static host. There is no server to write back
 * to and there will not be one. So edits live in a second place:
 *
 *      sealed base (life.enc.json)          read-only, from the Mac
 *   +  edit overlay (IndexedDB, encrypted)  written on this device
 *   =  what every screen renders
 *
 * An overlay record is one patch per item id, encrypted with the same key the
 * dashboard was unlocked with, stored in the "edits" object store. Checking a
 * box, changing a due date, renaming an item and adding a brand new item are
 * all the same operation: write a patch, re-derive.
 *
 * Consequences worth knowing:
 *   - Edits persist across reloads, app restarts and redeploys of the site,
 *     because a redeploy replaces the base data, not the overlay.
 *   - Edits are per device. A change made on the phone is not on the Mac until
 *     it is exported. That is the price of having no server, and exportJson()
 *     is the way across.
 *   - Re-sealing with --rotate changes the blob salt, and patches written
 *     under the old salt can no longer be decrypted. They are not lost or
 *     silently dropped: they hydrate as locked and are counted, so the UI can
 *     say so out loud.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LifeData } from '../types';
import { collectNodes, type LifeNode } from './nodes';
import type { ResolvedNode as CountableNode } from './progress';
import {
  applyDoneTransition,
  buildEditRecord,
  clearEdits,
  deleteEdit,
  editsMap,
  exportEditsJson,
  hydrateEdits,
  listEdits,
  mergeFields,
  parseEditsJson,
  putEdit,
  type EditFields,
  type EditView,
} from './edits';

/**
 * A base item with its overlay applied - what every screen actually renders.
 *
 * It extends the narrower ResolvedNode that src/lib/progress.ts counts, so the
 * two can never drift apart: anything the counters require, this must supply.
 */
export interface ResolvedNode extends CountableNode {
  /** True when the user has touched this item at all. */
  edited: boolean;
  /** Hidden from lists but still in the store, so it can come back. */
  archived: boolean;
  /** Free text the user attached on top of the base row. */
  note?: string;
  /** True for an item the user created here rather than one from the sealed data. */
  created: boolean;
}

/** Prefix for ids of items the user creates in the app. */
export const CREATED_PREFIX = 'new:';

function isCreatedId(id: string): boolean {
  return id.startsWith(CREATED_PREFIX);
}

/** Build the synthetic LifeNode for an item the user created in the app. */
function createdNode(id: string, fields: EditFields): LifeNode {
  return {
    id,
    rawId: id.slice(CREATED_PREFIX.length),
    source: 'created',
    kind: 'action',
    title: fields.title ?? 'Untitled',
    detail: fields.detail,
    area: fields.area ?? 'Inbox',
    zone: fields.zone ?? 'today',
    section: fields.section,
    due: fields.due ?? undefined,
    horizon: fields.horizon ?? undefined,
    status: fields.status,
    baseDone: false,
  };
}

/** Apply one patch to one base node. Undefined fields leave the base value alone; null clears it. */
export function applyFields(node: LifeNode, fields: EditFields | undefined): ResolvedNode {
  const base: ResolvedNode = {
    ...node,
    done: node.baseDone,
    edited: false,
    archived: false,
    created: isCreatedId(node.id),
  };
  if (!fields) return base;
  return {
    ...base,
    title: fields.title ?? base.title,
    detail: fields.detail ?? base.detail,
    due: fields.due === null ? undefined : (fields.due ?? base.due),
    horizon: fields.horizon === null ? undefined : (fields.horizon ?? base.horizon),
    status: fields.status ?? base.status,
    done: fields.done ?? base.done,
    doneAt: fields.doneAt === null ? undefined : (fields.doneAt ?? undefined),
    note: fields.note,
    archived: fields.archived ?? false,
    edited: true,
  };
}

/** Base data plus overlay, as one list. Created items come first so a new note is visible immediately. */
export function resolveNodes(data: LifeData | undefined, edits: Map<string, EditFields>): ResolvedNode[] {
  const base = data ? collectNodes(data) : [];
  const baseIds = new Set(base.map((n) => n.id));
  const created: ResolvedNode[] = [];
  for (const [id, fields] of edits) {
    if (isCreatedId(id) && !baseIds.has(id)) {
      created.push(applyFields(createdNode(id, fields), fields));
    }
  }
  const resolved = base.map((node) => applyFields(node, edits.get(node.id)));
  return [...created, ...resolved];
}

export interface Live {
  /** Every item, overlay applied, archived ones included. */
  all: ResolvedNode[];
  /** The list screens render - archived items removed. */
  nodes: ResolvedNode[];
  byId: Map<string, ResolvedNode>;
  /** False until the overlay has been read once, so nothing renders a half-merged list. */
  ready: boolean;
  /** Patches written under an older blob salt that cannot be read with the current key. */
  lockedCount: number;
  toggleDone: (id: string) => Promise<void>;
  patch: (id: string, fields: EditFields) => Promise<void>;
  create: (fields: EditFields) => Promise<string>;
  /** Drop the overlay for one item, putting it back exactly as the sealed data has it. */
  revert: (id: string) => Promise<void>;
  exportJson: () => string;
  importJson: (text: string) => Promise<number>;
  clearAll: () => Promise<void>;
}

export function useLive(data: LifeData | undefined, cryptoKey: CryptoKey | undefined, salt: string): Live {
  const [views, setViews] = useState<EditView[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!cryptoKey) {
      setViews([]);
      setReady(true);
      return;
    }
    const records = await listEdits().catch(() => []);
    setViews(await hydrateEdits(records, salt, cryptoKey));
    setReady(true);
  }, [cryptoKey, salt]);

  useEffect(() => {
    setReady(false);
    refresh();
  }, [refresh]);

  const edits = useMemo(() => editsMap(views), [views]);
  const all = useMemo(() => resolveNodes(data, edits), [data, edits]);
  const nodes = useMemo(() => all.filter((n) => !n.archived), [all]);
  const byId = useMemo(() => new Map(all.map((n) => [n.id, n])), [all]);
  const lockedCount = useMemo(() => views.filter((v) => v.locked).length, [views]);

  /** Merge a patch into whatever is already stored for this id, persist it, and re-derive. */
  const write = useCallback(
    async (id: string, incoming: EditFields) => {
      if (!cryptoKey) return;
      const current = edits.get(id);
      const merged = mergeFields(current, incoming);
      const record = await buildEditRecord(cryptoKey, salt, id, merged);
      await putEdit(record);
      await refresh();
    },
    [cryptoKey, edits, refresh, salt],
  );

  const toggleDone = useCallback(
    async (id: string) => {
      const node = byId.get(id);
      if (!node) return;
      await write(id, applyDoneTransition(edits.get(id), !node.done));
    },
    [byId, edits, write],
  );

  const patch = useCallback((id: string, fields: EditFields) => write(id, fields), [write]);

  const create = useCallback(
    async (fields: EditFields) => {
      const id = `${CREATED_PREFIX}${globalThis.crypto.randomUUID()}`;
      await write(id, fields);
      return id;
    },
    [write],
  );

  const revert = useCallback(
    async (id: string) => {
      await deleteEdit(id);
      await refresh();
    },
    [refresh],
  );

  const exportJson = useCallback(() => exportEditsJson(views), [views]);

  const importJson = useCallback(
    async (text: string) => {
      if (!cryptoKey) return 0;
      const incoming = parseEditsJson(text);
      for (const entry of incoming) {
        const merged = mergeFields(edits.get(entry.id), entry.fields);
        await putEdit(await buildEditRecord(cryptoKey, salt, entry.id, merged));
      }
      await refresh();
      return incoming.length;
    },
    [cryptoKey, edits, refresh, salt],
  );

  const clearAll = useCallback(async () => {
    await clearEdits();
    await refresh();
  }, [refresh]);

  return { all, nodes, byId, ready, lockedCount, toggleDone, patch, create, revert, exportJson, importJson, clearAll };
}
