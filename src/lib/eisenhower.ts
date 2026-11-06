/**
 * Eisenhower 2x2 for the Life OS view. Pure: no React, no DOM.
 *
 *   urgent    = overdue, due within 3 days, or flagged urgent
 *   important = flagged important, or bucket 2, 5 or 6 with a due date
 *
 * This only decides which quadrant an item sits in. "When" is still worded by
 * src/lib/grade.ts; every chip keeps its grade icon and word.
 */

import { bucketOf, type BucketId, type BucketInput } from './bucket';
import { daysToEndOfWeek, gradeOf } from './grade';
import { daysUntil } from './date';

export type Quadrant = 'do' | 'schedule' | 'delegate' | 'drop';

export const QUADRANTS: Array<{ id: Quadrant; title: string; caption: string }> = [
  { id: 'do', title: 'Do now', caption: 'Urgent and important' },
  { id: 'schedule', title: 'Schedule', caption: 'Important, not urgent' },
  { id: 'delegate', title: 'Delegate', caption: 'Urgent, not important' },
  { id: 'drop', title: 'Drop', caption: 'Neither' },
];

/** Days out that still counts as urgent. */
export const URGENT_WITHIN_DAYS = 3;
const IMPORTANT_BUCKETS: BucketId[] = [2, 5, 6];

export interface EisenInput extends BucketInput {
  due?: string;
  horizon?: string;
  done: boolean;
  urgent?: boolean;
  important?: boolean;
}

export function isUrgent(item: EisenInput, now: Date): boolean {
  if (item.urgent) return true;
  if (!item.due) return false;
  const d = daysUntil(item.due, now);
  return d !== undefined && d <= URGENT_WITHIN_DAYS;
}

export function isImportant(item: EisenInput): boolean {
  if (item.important) return true;
  return Boolean(item.due) && IMPORTANT_BUCKETS.includes(bucketOf(item));
}

export function quadrantOf(item: EisenInput, now: Date): Quadrant {
  const u = isUrgent(item, now);
  const i = isImportant(item);
  if (u && i) return 'do';
  if (i) return 'schedule';
  if (u) return 'delegate';
  return 'drop';
}

export interface KpiCounts {
  open: number;
  dueThisWeek: number;
  overdue: number;
}

/** Open = not done. Due this week = dated, today through the coming Sunday. Overdue = dated before today. */
export function kpiCounts(items: Array<EisenInput>, now: Date): KpiCounts {
  let open = 0;
  let dueThisWeek = 0;
  let overdue = 0;
  const end = daysToEndOfWeek(now);
  for (const item of items) {
    if (item.done) continue;
    open += 1;
    if (!item.due) continue;
    const d = daysUntil(item.due, now);
    if (d === undefined) continue;
    if (gradeOf({ due: item.due, done: false }, now) === 'overdue') overdue += 1;
    else if (d <= end) dueThisWeek += 1;
  }
  return { open, dueThisWeek, overdue };
}

export interface CalendarEntry {
  date: string;
  title: string;
  bucket: number;
}

export interface StripDay {
  date: string;
  weekday: string;
  dayOfMonth: number;
  isToday: boolean;
  entries: CalendarEntry[];
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Seven days starting today, each with the entries dated that day. Malformed entries are ignored. */
export function weekStrip(entries: unknown, now: Date): StripDay[] {
  const list: CalendarEntry[] = Array.isArray(entries)
    ? entries.filter(
        (e): e is CalendarEntry =>
          !!e && typeof e.date === 'string' && typeof e.title === 'string' && /^\d{4}-\d{2}-\d{2}/.test(e.date),
      )
    : [];
  const days: StripDay[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const key = iso(d);
    days.push({
      date: key,
      weekday: WEEKDAYS[d.getDay()],
      dayOfMonth: d.getDate(),
      isToday: i === 0,
      entries: list.filter((e) => e.date.slice(0, 10) === key),
    });
  }
  return days;
}
