/**
 * Live date math for the UI. Dates in LifeData are always absolute ISO
 * strings; every relative label ("in 3 days", "today", "overdue") is
 * computed here from the real current date at render time, never stored.
 */

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Parse a "YYYY-MM-DD" (or full ISO) date string as a local calendar date. */
export function parseDateOnly(iso: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return undefined;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

/** Whole calendar days between today and the given ISO date (negative = past). */
export function daysUntil(iso: string, now: Date = new Date()): number | undefined {
  const target = parseDateOnly(iso);
  if (!target) return undefined;
  const diffMs = startOfDay(target).getTime() - startOfDay(now).getTime();
  return Math.round(diffMs / 86_400_000);
}

export type CountdownTone = 'overdue' | 'today' | 'soon' | 'upcoming' | 'done';

export interface Countdown {
  label: string;
  tone: CountdownTone;
}

/**
 * Live countdown chip for a calendar-ish item. If `done` is true (an
 * explicit "state: done" in the data), this always reads "Done" instead of
 * computing a date - past events that already happened should not be
 * flagged as overdue.
 */
export function countdown(iso: string, done = false, now: Date = new Date()): Countdown {
  if (done) return { label: 'Done', tone: 'done' };
  const d = daysUntil(iso, now);
  if (d === undefined) return { label: iso, tone: 'upcoming' };
  if (d < 0) return { label: `${Math.abs(d)}d overdue`, tone: 'overdue' };
  if (d === 0) return { label: 'Today', tone: 'today' };
  if (d === 1) return { label: 'Tomorrow', tone: 'soon' };
  if (d <= 7) return { label: `In ${d} days`, tone: 'soon' };
  return { label: `In ${d} days`, tone: 'upcoming' };
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** "Sep 18, 2026" style label for a YYYY-MM-DD date. */
export function formatDate(iso: string): string {
  const d = parseDateOnly(iso);
  if (!d) return iso;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "Sep 15, 2026, 12:58 PM" style label for a full ISO timestamp. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const datePart = `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  const timePart = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${datePart}, ${timePart}`;
}
