/**
 * Edit overlay: user edits to base LifeData items, encrypted at rest with
 * the same AES key the rest of the dashboard unlocks with, stored in the
 * "edits" IndexedDB store (src/idb.ts).
 *
 * Every record on disk (StoredEdit) keeps its patch fields as ciphertext -
 * plaintext only ever exists in memory, inside an EditView, for as long as
 * the app is unlocked. A record written under an older blob salt (the data
 * was re-sealed with --rotate since) cannot be decrypted with the current
 * key and hydrates as locked: true instead of throwing.
 */

import { decryptWithKey, encryptWithKey, WrongPassphraseError } from '../crypto';
import { EDITS_STORE, openDb } from '../idb';

/** The editable fields an overlay patch can override on any item. */
export interface EditFields {
  title?: string;
  detail?: string;
  /** ISO YYYY-MM-DD, or null to clear an inherited due date. */
  due?: string | null;
  /** 'now' | 'week' | 'later' | 'routine', or null to clear. */
  horizon?: string | null;
  status?: string;
  done?: boolean;
  /** ISO 8601 timestamp with offset - set when done flips false -> true, cleared when it flips back. */
  doneAt?: string | null;
  /** Soft delete - the item stays in the base data but the UI hides it. */
  archived?: boolean;
  /** Free-text note the user adds on top of the base row. */
  note?: string;
  /*
   * The three below are only ever set on an item the user created in the app
   * (a patch whose id starts with "new:", see src/lib/live.ts). A patch over a
   * sealed base item leaves them undefined - an item never changes which area
   * or screen it belongs to, only what it says and when it is due.
   */
  /** Life-area tag for a created item. */
  area?: string;
  /** Zone id a created item belongs to. */
  zone?: string;
  /** Section id a created item belongs to, when it has one. */
  section?: string;
}

/** What is persisted: one record per edited item id, ciphertext only. */
export interface StoredEdit {
  /** The LifeNode id being patched, e.g. "actions:a-1". Also the IndexedDB key. */
  id: string;
  /** ISO 8601 timestamp with offset - last write. */
  at: string;
  /** The sealed blob salt this record was encrypted under. */
  salt: string;
  iv: string;
  ct: string;
}

/** Hydrated in memory while unlocked. `locked` records withhold their fields. */
export interface EditView { id: string; at: string; locked: boolean; fields?: EditFields }

/** A record written under a different blob salt than the one currently unlocked - locked, regardless of key availability. */
function isStale(record: Pick<StoredEdit, 'salt'>, currentSalt: string): boolean {
  return record.salt !== currentSalt;
}

/**
 * Shallow-merge an incoming patch onto a base patch. A key explicitly set to
 * undefined in `incoming` is ignored (whatever `base` has, if anything,
 * survives); a key set to null is kept as an explicit clear.
 */
export function mergeFields(base: EditFields | undefined, incoming: EditFields): EditFields {
  const merged: EditFields = { ...(base ?? {}) };
  if (incoming.title !== undefined) merged.title = incoming.title;
  if (incoming.detail !== undefined) merged.detail = incoming.detail;
  if (incoming.due !== undefined) merged.due = incoming.due;
  if (incoming.horizon !== undefined) merged.horizon = incoming.horizon;
  if (incoming.status !== undefined) merged.status = incoming.status;
  if (incoming.done !== undefined) merged.done = incoming.done;
  if (incoming.doneAt !== undefined) merged.doneAt = incoming.doneAt;
  if (incoming.archived !== undefined) merged.archived = incoming.archived;
  if (incoming.note !== undefined) merged.note = incoming.note;
  return merged;
}

/**
 * Flip an item's done state. Flipping to true stamps doneAt with `now`;
 * flipping to false clears it. Idempotent - re-applying the same target
 * state (e.g. saving other fields while already done) keeps the original
 * doneAt instead of bumping it to `now` again.
 */
export function applyDoneTransition(current: EditFields | undefined, done: boolean, now: Date = new Date()): EditFields {
  if (!done) {
    return { done: false, doneAt: null };
  }
  const alreadyDone = current?.done === true;
  return { done: true, doneAt: alreadyDone ? (current?.doneAt ?? now.toISOString()) : now.toISOString() };
}

/** Unlocked views only, keyed by item id - what render merges over the base data. */
export function editsMap(views: EditView[]): Map<string, EditFields> {
  const map = new Map<string, EditFields>();
  for (const view of views) {
    if (!view.locked && view.fields !== undefined) {
      map.set(view.id, view.fields);
    }
  }
  return map;
}

/** Encrypt one item's patch fields with the unlocked key and build the full record ready to store. */
export async function buildEditRecord(
  key: CryptoKey,
  currentSalt: string,
  id: string,
  fields: EditFields,
  now: Date = new Date(),
): Promise<StoredEdit> {
  const { iv, ct } = await encryptWithKey(key, fields);
  return { id, at: now.toISOString(), salt: currentSalt, iv, ct };
}

/** Decrypt one record's patch fields. Throws WrongPassphraseError if the key doesn't match, or the payload isn't a fields object. */
export async function decryptEditFields(record: Pick<StoredEdit, 'iv' | 'ct'>, key: CryptoKey): Promise<EditFields> {
  const value = await decryptWithKey({ iv: record.iv, ct: record.ct }, key);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new WrongPassphraseError();
  }
  return value as EditFields;
}

/** One record -> its view: locked (no key, stale salt, or a decrypt failure) or hydrated with its plaintext fields. */
async function hydrateEdit(record: StoredEdit, currentSalt: string, key: CryptoKey | undefined): Promise<EditView> {
  if (!key || isStale(record, currentSalt)) {
    return { id: record.id, at: record.at, locked: true };
  }
  try {
    const fields = await decryptEditFields(record, key);
    return { id: record.id, at: record.at, locked: false, fields };
  } catch {
    return { id: record.id, at: record.at, locked: true };
  }
}

/** Hydrated view of a set of edit records - never throws, regardless of key state or corrupted records. */
export async function hydrateEdits(
  records: StoredEdit[],
  currentSalt: string,
  key: CryptoKey | undefined,
): Promise<EditView[]> {
  return Promise.all(records.map((record) => hydrateEdit(record, currentSalt, key)));
}

/** The on-disk shape of an edits export file - see exportEditsJson/parseEditsJson. */
interface EditsExportShape {
  kind: string;
  version: number;
  exportedAt: string;
  edits: Array<{ id?: string; at?: string; fields?: EditFields }>;
}

/** Unlocked views only, as plaintext pretty JSON, ids sorted ascending so repeat exports of the same edits are byte-identical. */
export function exportEditsJson(views: EditView[], now: Date = new Date()): string {
  const edits = views
    .filter((v): v is EditView & { fields: EditFields } => !v.locked && v.fields !== undefined)
    .map((v) => ({ id: v.id, at: v.at, fields: v.fields }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const payload: EditsExportShape = {
    kind: 'life-dashboard-edits',
    version: 1,
    exportedAt: now.toISOString(),
    edits,
  };
  return JSON.stringify(payload, null, 2);
}

/** Parse an edits export file back into patch entries. Throws on anything that isn't a recognized edits export. */
export function parseEditsJson(text: string): { id: string; at: string; fields: EditFields }[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Not a Life Dashboard edits file.');
  }
  const shape = parsed as Partial<EditsExportShape> | null | undefined;
  if (!shape || shape.kind !== 'life-dashboard-edits' || shape.version !== 1) {
    throw new Error('Not a Life Dashboard edits file.');
  }
  const edits = shape.edits;
  if (!Array.isArray(edits)) {
    throw new Error('Not a Life Dashboard edits file.');
  }
  return edits
    .filter((entry): entry is { id: string; at?: string; fields?: EditFields } => typeof entry?.id === 'string')
    .map((entry) => ({ id: entry.id, at: entry.at ?? '', fields: entry.fields ?? {} }));
}

/* ------------------------------ IndexedDB I/O ------------------------------ */

export async function listEdits(): Promise<StoredEdit[]> {
  const db = await openDb();
  try {
    return await new Promise<StoredEdit[]>((resolve, reject) => {
      const tx = db.transaction(EDITS_STORE, 'readonly');
      const req = tx.objectStore(EDITS_STORE).getAll();
      req.onsuccess = () => resolve((req.result as StoredEdit[] | undefined) ?? []);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function putEdit(record: StoredEdit): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(EDITS_STORE, 'readwrite');
      tx.objectStore(EDITS_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function deleteEdit(id: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(EDITS_STORE, 'readwrite');
      tx.objectStore(EDITS_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function clearEdits(): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(EDITS_STORE, 'readwrite');
      tx.objectStore(EDITS_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
