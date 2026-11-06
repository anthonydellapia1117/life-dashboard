/**
 * Life OS web and bucket tiles - the data model behind the Life OS tab.
 *
 * The personal part (node labels, links, tile copy, the folder map) lives in
 * data/lifeos.json on the Mac. scripts/seal.mjs folds it into the sealed blob
 * as `lifeos`, so it reaches the deployed site encrypted, the same way as
 * everything else. This file only holds the shape, generic fallbacks, and the
 * pure graph builder. Pure: no React, no DOM.
 */
import { BUCKETS, bucketOf, type BucketId } from './bucket';
import { SECTION_LABELS, type SectionId } from './routing';

export interface LifeOsNodeRow {
  id?: string;
  label: string;
  bucket: number;
}

export interface LifeOsFolderRow {
  folder: string;
  /** Bucket number, or a word such as "catch-all" / "weekly sort". */
  bucket: number | string;
}

export interface LifeOsData {
  nodes?: LifeOsNodeRow[];
  /** Pairs of node labels (or ids). */
  links?: Array<[string, string]>;
  /** Tile copy per bucket number: what goes in. */
  tiles?: Record<string, string>;
  /** Drive folder per bucket number, shown on the tile. */
  tileFolders?: Record<string, string>;
  folders?: LifeOsFolderRow[];
  /** Static per-bucket counts from the last file sort. */
  filesFiled?: Record<string, number>;
  filesFiledAsOf?: string;
  tiebreak?: string;
}

/** Generic copy used until the sealed data supplies its own. */
export const FALLBACK_TILES: Record<BucketId, string> = {
  1: 'Personal tasks, health, workouts, sports, errands, habits, reading.',
  2: 'People you love, family events, trips, household, photos.',
  3: 'Job search, recruiters, networking, community groups.',
  4: 'Side ventures and builds that could make money.',
  5: 'Taxes, mortgage, utilities, subscriptions, cards, loans.',
  6: 'Engagements, PMO, solution architecture, anything that pays you.',
};

/** Files filed per bucket in the 2026-11-06 Mac file sort. Static: the sealed data can override it. */
export const FILES_FILED: Record<BucketId, number> = { 1: 75, 2: 204, 3: 39, 4: 7, 5: 59, 6: 130 };
export const FILES_FILED_AS_OF = '2026-11-06';

export const FALLBACK_TIEBREAK =
  'Makes money = 4 or 6, costs money = 5, about a person you love = 2, everything else = 1.';

export type WebNodeKind = 'hub' | 'node' | 'section';

export interface WebNode {
  id: string;
  label: string;
  bucket: BucketId;
  kind: WebNodeKind;
  /** Open items behind a section node. */
  count?: number;
}

export interface WebLink {
  source: string;
  target: string;
  /** Hub spoke (node to its bucket) vs a cross link between two nodes. */
  kind: 'spoke' | 'cross';
}

export interface WebGraph {
  nodes: WebNode[];
  links: WebLink[];
}

function asBucket(n: unknown): BucketId | undefined {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 6 ? (n as BucketId) : undefined;
}

export function hubId(b: BucketId): string {
  return `hub:${b}`;
}

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export interface SectionCount {
  section: string;
  open: number;
}

/**
 * Six hubs, every data node spoked to its hub, cross links resolved by label
 * or id (unknown names are dropped, never thrown), and an optional node per
 * section that holds open items.
 */
export function buildWeb(data: LifeOsData | undefined, sections: SectionCount[] = []): WebGraph {
  const nodes: WebNode[] = BUCKETS.map((b) => ({ id: hubId(b.id), label: b.name, bucket: b.id, kind: 'hub' }));
  const links: WebLink[] = [];
  const byName = new Map<string, string>();
  const seen = new Set(nodes.map((n) => n.id));

  for (const row of data?.nodes ?? []) {
    const bucket = asBucket(row?.bucket);
    if (!bucket || typeof row.label !== 'string' || !row.label.trim()) continue;
    const id = `n:${row.id ?? slug(row.label)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    nodes.push({ id, label: row.label, bucket, kind: 'node' });
    byName.set(row.label.toLowerCase(), id);
    if (row.id) byName.set(row.id.toLowerCase(), id);
    links.push({ source: id, target: hubId(bucket), kind: 'spoke' });
  }

  const pairs = new Set<string>();
  for (const pair of data?.links ?? []) {
    if (!Array.isArray(pair) || pair.length !== 2) continue;
    const a = byName.get(String(pair[0]).toLowerCase());
    const b = byName.get(String(pair[1]).toLowerCase());
    if (!a || !b || a === b) continue;
    const key = [a, b].sort().join('|');
    if (pairs.has(key)) continue;
    pairs.add(key);
    links.push({ source: a, target: b, kind: 'cross' });
  }

  for (const { section, open } of sections) {
    if (open <= 0) continue;
    const label = (SECTION_LABELS as Record<string, string>)[section as SectionId] ?? section;
    const bucket = bucketOf({ section });
    const id = `s:${section}`;
    if (seen.has(id)) continue;
    seen.add(id);
    nodes.push({ id, label: `${label} - ${open} open`, bucket, kind: 'section', count: open });
    links.push({ source: id, target: hubId(bucket), kind: 'spoke' });
  }

  return { nodes, links };
}

/** Open-item count per section, for buildWeb's section nodes. */
export function sectionCounts(items: Array<{ section?: string; done?: boolean }>): SectionCount[] {
  const map = new Map<string, number>();
  for (const it of items) {
    if (it.done || !it.section) continue;
    map.set(it.section, (map.get(it.section) ?? 0) + 1);
  }
  return [...map.entries()].map(([section, open]) => ({ section, open }));
}
