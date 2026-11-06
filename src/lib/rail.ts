/**
 * The progress rail under the nav: where "now" sits in the day, the week and
 * the month, so moving through the tabs reads as one guided roadmap. Weeks
 * start on Monday (dayIndex 0) and end on Sunday (dayIndex 6). Every figure is
 * continuous - the time of day counts - so the rail moves through the day
 * rather than jumping at midnight.
 *
 * Pure and DOM-free so it runs under vitest's node environment.
 */

export interface WeekPosition {
  /** Monday 0 ... Sunday 6. */
  dayIndex: number;
  /** Share of today already gone, 0-100. */
  dayPct: number;
  /** Share of this Monday-to-Sunday week already gone, 0-100. */
  weekPct: number;
  /** Share of this calendar month already gone, 0-100. */
  monthPct: number;
  /** One readable line for screen readers and the title tooltip. */
  label: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Where `now` sits in its day, week and month, in local time. */
export function weekPosition(now: Date): WeekPosition {
  const dayIndex = (now.getDay() + 6) % 7;
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayFrac = Math.min(1, Math.max(0, (now.getTime() - midnight) / DAY_MS));
  const days = daysInMonth(now.getFullYear(), now.getMonth());
  const dayPct = dayFrac * 100;
  const weekPct = ((dayIndex + dayFrac) / 7) * 100;
  const monthPct = ((now.getDate() - 1 + dayFrac) / days) * 100;
  const label = `${WEEKDAYS[dayIndex]}, day ${dayIndex + 1} of 7 this week, day ${now.getDate()} of ${days} this month`;
  return { dayIndex, dayPct, weekPct, monthPct, label };
}

/**
 * Cap a list for the ADHD rule "every list capped with +N more". Returns the
 * rows to draw and how many are folded away. A cap of zero or less, or an
 * open list, shows everything.
 */
export function capItems<T>(items: readonly T[], cap: number, open = false): { shown: T[]; hidden: number } {
  if (open || cap <= 0 || items.length <= cap) return { shown: items.slice(), hidden: 0 };
  return { shown: items.slice(0, cap), hidden: items.length - cap };
}

/** The caps, in one place so every tab reads the same. */
export const CAPS = {
  focus: 3,
  upNext: 5,
  agendaPerDay: 5,
  table: 8,
  claudeStream: 12,
  code: 15,
  boardColumn: 8,
} as const;
