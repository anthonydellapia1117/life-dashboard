/**
 * The counter layer the UI reads: turn a set of resolved nodes (a LifeNode
 * plus its live "done" state) into totals, per-group breakdowns, and per-day
 * completion history. Everything here is derived live from the node list
 * handed in - nothing is cached or stored by this module.
 */

import type { LifeNode } from './nodes';

export interface ResolvedNode extends LifeNode {
  done: boolean;
  doneAt?: string;
}

export interface Counts {
  total: number;
  done: number;
  left: number;
  /** 0-100, rounded to an integer. A zero total always reads 0, never NaN. */
  pct: number;
}

/** Total / done / left / done-percent for a set of nodes. */
export function countNodes(nodes: ResolvedNode[]): Counts {
  const total = nodes.length;
  const done = nodes.filter((n) => n.done).length;
  const left = total - done;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, left, pct };
}

/**
 * Group nodes by a derived key and count each group. Keys come out ordered
 * by first appearance in `nodes`, not sorted alphabetically or by size.
 */
export function countBy<K extends string>(nodes: ResolvedNode[], key: (n: ResolvedNode) => K): Map<K, Counts> {
  const groups = new Map<K, ResolvedNode[]>();
  for (const node of nodes) {
    const k = key(node);
    const group = groups.get(k);
    if (group) group.push(node);
    else groups.set(k, [node]);
  }

  const result = new Map<K, Counts>();
  for (const [k, group] of groups) {
    result.set(k, countNodes(group));
  }
  return result;
}

export function countsByArea(nodes: ResolvedNode[]): Map<string, Counts> {
  return countBy(nodes, (n) => n.area);
}

export function countsByZone(nodes: ResolvedNode[]): Map<string, Counts> {
  return countBy(nodes, (n) => n.zone);
}

/** Section key is "zone/section" - nodes with no section fall under an empty section suffix, per zone. */
export function countsBySection(nodes: ResolvedNode[]): Map<string, Counts> {
  return countBy(nodes, (n) => `${n.zone}/${n.section ?? ''}`);
}

/** First 10 characters of an ISO string - its plain YYYY-MM-DD date part. */
function datePart(iso: string): string {
  return iso.slice(0, 10);
}

/** Done nodes whose doneAt date falls in [startISO, endISO] inclusive - compared as plain YYYY-MM-DD strings. */
export function completedBetween(nodes: ResolvedNode[], startISO: string, endISO: string): ResolvedNode[] {
  const start = datePart(startISO);
  const end = datePart(endISO);
  return nodes.filter((n) => {
    if (!n.done || !n.doneAt) return false;
    const day = datePart(n.doneAt);
    return day >= start && day <= end;
  });
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** "YYYY-MM-DD" for a Date's own local calendar day - never its UTC day. */
function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Completion counts per day for the last `days` local calendar days, oldest
 * first, ending on today and zero-filled. Each doneAt is read back through
 * local Date getters (never a UTC string slice), so a completion logged
 * late in the evening still lands on that same local day, not the next one.
 */
export function completionsByDay(
  nodes: ResolvedNode[],
  days: number,
  now: Date = new Date(),
): { date: string; count: number }[] {
  const today = startOfLocalDay(now);
  const span = Math.max(0, days);
  const dateKeys: string[] = [];
  for (let i = span - 1; i >= 0; i -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    dateKeys.push(localDateKey(d));
  }

  const counts = new Map<string, number>();
  for (const n of nodes) {
    if (!n.done || !n.doneAt) continue;
    const parsed = new Date(n.doneAt);
    if (Number.isNaN(parsed.getTime())) continue;
    const key = localDateKey(parsed);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return dateKeys.map((date) => ({ date, count: counts.get(date) ?? 0 }));
}
