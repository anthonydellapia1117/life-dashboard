/**
 * Timeline / roadmap view over the life data: nodes bucketed by due month,
 * either as one overall roadmap or split into one lane per area.
 *
 * Bucketing is always: an "overdue" bucket (due strictly before today), a
 * fixed run of consecutive month buckets starting with the current month
 * (present even when empty - an empty month is a visible gap on a
 * roadmap), then a "someday" bucket for anything undated or due past the
 * window. Overdue and someday are omitted entirely when empty; the month
 * buckets never are.
 */

import type { LifeNode } from './nodes';
import { parseDateOnly, daysUntil } from './date';

export interface RoadmapItem {
  nodeId: string;
  title: string;
  area: string;
  due: string;
  daysOut: number;
}

export interface RoadmapBucket {
  /** Stable key, e.g. '2026-09' for a month bucket or 'overdue' / 'someday'. */
  key: string;
  /** Human label, e.g. 'Sep 2026', 'Overdue', 'No date'. */
  label: string;
  items: RoadmapItem[];
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const OVERDUE_KEY = 'overdue';
const SOMEDAY_KEY = 'someday';

interface MonthDescriptor {
  key: string;
  label: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function monthDescriptor(year: number, month0: number): MonthDescriptor {
  return { key: `${year}-${pad2(month0 + 1)}`, label: `${MONTHS[month0]} ${year}` };
}

/** Exactly `months` consecutive month descriptors, starting with `now`'s month. */
function buildMonthList(now: Date, months: number): MonthDescriptor[] {
  const list: MonthDescriptor[] = [];
  const y = now.getFullYear();
  const m = now.getMonth();
  for (let i = 0; i < months; i++) {
    const d = new Date(y, m + i, 1);
    list.push(monthDescriptor(d.getFullYear(), d.getMonth()));
  }
  return list;
}

/** Which bucket key a node's due date falls into, given the window bounds. */
/**
 * A finished item is never overdue. It still happened in the month it was due,
 * so it keeps its month bucket - but putting it under "Overdue" would have the
 * roadmap and the board describing the same item two different ways.
 */
function isFinished(node: LifeNode): boolean {
  const done = (node as LifeNode & { done?: boolean }).done;
  return done ?? node.baseDone;
}

function bucketKeyFor(node: LifeNode, todayStart: Date, windowEnd: Date): string {
  if (!node.due) return SOMEDAY_KEY;
  const d = parseDateOnly(node.due);
  if (!d) return SOMEDAY_KEY;
  if (d.getTime() >= windowEnd.getTime()) return SOMEDAY_KEY;
  if (d.getTime() < todayStart.getTime()) {
    if (!isFinished(node)) return OVERDUE_KEY;
    // Past and done: fall through to its own month, which may sit before the
    // window - in that case it belongs with the undated tail, not with the late work.
    const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    return key;
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function toRoadmapItem(node: LifeNode, now: Date): RoadmapItem {
  const due = node.due;
  const parsedDaysOut = due ? daysUntil(due, now) : undefined;
  return {
    nodeId: node.id,
    title: node.title,
    area: node.area,
    // Empty string is the "no due date" sentinel - only ever seen inside
    // the someday bucket, which never sorts or renders by date anyway.
    due: due ?? '',
    daysOut: parsedDaysOut ?? Number.POSITIVE_INFINITY,
  };
}

function sortItems(items: RoadmapItem[]): RoadmapItem[] {
  return [...items].sort((a, b) => {
    if (a.due !== b.due) return a.due < b.due ? -1 : 1;
    if (a.title !== b.title) return a.title < b.title ? -1 : 1;
    return 0;
  });
}

/** Buckets every node by key (overdue / 'YYYY-MM' / someday), no omission. */
function bucketNodes(nodes: LifeNode[], now: Date, months: number): Map<string, RoadmapItem[]> {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const windowEnd = new Date(now.getFullYear(), now.getMonth() + months, 1);

  const byKey = new Map<string, RoadmapItem[]>();
  for (const node of nodes) {
    const key = bucketKeyFor(node, todayStart, windowEnd);
    const item = toRoadmapItem(node, now);
    const list = byKey.get(key);
    if (list) list.push(item);
    else byKey.set(key, [item]);
  }
  return byKey;
}

function bucketsForShape(
  nodes: LifeNode[],
  now: Date,
  months: number,
  shape: MonthDescriptor[],
): RoadmapBucket[] {
  const byKey = bucketNodes(nodes, now, months);
  return shape.map(({ key, label }) => ({ key, label, items: sortItems(byKey.get(key) ?? []) }));
}

/**
 * Overall roadmap: an omitted-when-empty overdue bucket, `months` (default
 * 6) consecutive month buckets starting this month (kept even when empty),
 * then an omitted-when-empty someday bucket. Items sort by due ascending,
 * then title ascending.
 */
export function roadmapByMonth(nodes: LifeNode[], now: Date = new Date(), months = 6): RoadmapBucket[] {
  const monthList = buildMonthList(now, months);
  const byKey = bucketNodes(nodes, now, months);

  const buckets: RoadmapBucket[] = [];

  const overdueItems = byKey.get(OVERDUE_KEY) ?? [];
  if (overdueItems.length > 0) {
    buckets.push({ key: OVERDUE_KEY, label: 'Overdue', items: sortItems(overdueItems) });
  }

  for (const month of monthList) {
    buckets.push({ key: month.key, label: month.label, items: sortItems(byKey.get(month.key) ?? []) });
  }

  const somedayItems = byKey.get(SOMEDAY_KEY) ?? [];
  if (somedayItems.length > 0) {
    buckets.push({ key: SOMEDAY_KEY, label: 'No date', items: sortItems(somedayItems) });
  }

  return buckets;
}

/**
 * The same bucketing, split into one lane per area. Areas sort by item
 * count descending, then name ascending. Every lane carries exactly the
 * same bucket keys, in the same order, as `roadmapByMonth` - including an
 * overdue or someday bucket that is empty for that particular area - so
 * the lanes line up as a grid.
 */
export function roadmapLanes(
  nodes: LifeNode[],
  now: Date = new Date(),
  months = 6,
): Array<{ area: string; buckets: RoadmapBucket[] }> {
  const overall = roadmapByMonth(nodes, now, months);
  const shape: MonthDescriptor[] = overall.map((bucket) => ({ key: bucket.key, label: bucket.label }));

  const areaOrder: string[] = [];
  const areaSeen = new Set<string>();
  const byArea = new Map<string, LifeNode[]>();
  for (const node of nodes) {
    if (!areaSeen.has(node.area)) {
      areaSeen.add(node.area);
      areaOrder.push(node.area);
    }
    const list = byArea.get(node.area);
    if (list) list.push(node);
    else byArea.set(node.area, [node]);
  }

  const sortedAreas = [...areaOrder].sort((a, b) => {
    const countA = byArea.get(a)!.length;
    const countB = byArea.get(b)!.length;
    if (countA !== countB) return countB - countA;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  return sortedAreas.map((area) => ({
    area,
    buckets: bucketsForShape(byArea.get(area)!, now, months, shape),
  }));
}

/**
 * The dated span across all nodes with a valid due date: earliest and
 * latest ISO date, and the whole number of days between them. `days` is 0
 * when fewer than two nodes carry a due date (including zero).
 */
export function spanDays(
  nodes: LifeNode[],
  // Accepted for symmetry with the rest of this module (every other
  // function here takes an explicit "now" for testability). The dated
  // span is a property of the data's own due dates, not of today, so it
  // is intentionally unused.
  now?: Date,
): { firstISO?: string; lastISO?: string; days: number } {
  void now;

  const dated: Array<{ node: LifeNode; date: Date }> = [];
  for (const node of nodes) {
    if (!node.due) continue;
    const date = parseDateOnly(node.due);
    if (!date) continue;
    dated.push({ node, date });
  }

  if (dated.length === 0) return { days: 0 };

  let first = dated[0];
  let last = dated[0];
  for (const entry of dated) {
    if (entry.date.getTime() < first.date.getTime()) first = entry;
    if (entry.date.getTime() > last.date.getTime()) last = entry;
  }

  const days = Math.round((last.date.getTime() - first.date.getTime()) / 86_400_000);
  return { firstISO: first.node.due, lastISO: last.node.due, days };
}
