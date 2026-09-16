/**
 * Progress mechanics layered on top of the node counters: XP that rewards
 * finishing urgent work over raw volume, a level curve on top of it, and
 * the streak / momentum readouts the UI shows alongside both. Every
 * function here is pure - "today" always comes in as an argument, never
 * from the clock directly.
 */

import type { Grade } from './grade';

/** XP awarded for finishing one node, by the grade it held at the moment it was finished. */
export const XP_BY_GRADE: Record<Grade, number> = {
  overdue: 12,
  today: 10,
  tomorrow: 8,
  thisWeek: 6,
  nextWeek: 4,
  later: 2,
  someday: 1,
  done: 0,
};

export function xpFor(grade: Grade): number {
  return XP_BY_GRADE[grade];
}

export interface Level {
  level: number;
  title: string;
  xpIntoLevel: number;
  xpForNextLevel: number;
  /** 0-100, rounded to an integer progress through the current level. */
  pct: number;
}

/** Neutral, one-word level titles - cycles through in order, then holds on the last one past level 7. */
const LEVEL_TITLES = ['Starting', 'Steady', 'Building', 'Sharp', 'Focused', 'Compounding', 'Relentless'];

/** Cumulative XP needed to reach `level` starting from level 1 (level 1 itself needs 0). */
function xpToReach(level: number): number {
  const n = level - 1;
  return (50 * n * (n + 1)) / 2;
}

/** Triangular level curve: level n needs 50 * n * (n + 1) / 2 cumulative XP to reach level n + 1. */
export function levelFor(totalXp: number): Level {
  const xp = Math.max(0, totalXp);
  let level = 1;
  while (xp >= xpToReach(level + 1)) {
    level += 1;
  }

  const floor = xpToReach(level);
  const xpForNextLevel = xpToReach(level + 1) - floor;
  const xpIntoLevel = xp - floor;
  const pct = xpForNextLevel === 0 ? 0 : Math.round((xpIntoLevel / xpForNextLevel) * 100);
  const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];

  return { level, title, xpIntoLevel, xpForNextLevel, pct };
}

export interface Streak {
  current: number;
  longest: number;
  lastDay?: string;
}

export interface Momentum {
  thisWeek: number;
  lastWeek: number;
  delta: number;
  trend: 'up' | 'flat' | 'down';
}

interface DayCount {
  date: string;
  count: number;
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Index of "today" (per `now`) inside a zero-filled day list - falls back to the list's last entry if today isn't in it. */
function todayIndexIn(days: DayCount[], now: Date): number {
  if (days.length === 0) return -1;
  const key = localDateKey(now);
  const found = days.findIndex((d) => d.date === key);
  return found >= 0 ? found : days.length - 1;
}

/**
 * Current and longest completion streaks from a zero-filled, oldest-first
 * day list - the shape completionsByDay returns. Today reading 0 does not
 * break the streak by itself, since today is not over yet; a day only ends
 * a run once it is fully in the past.
 */
export function streakFrom(days: DayCount[], now: Date = new Date()): Streak {
  let longest = 0;
  let run = 0;
  for (const day of days) {
    if (day.count > 0) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }

  const anchor = todayIndexIn(days, now);
  if (anchor < 0) return { current: 0, longest, lastDay: undefined };

  let start = anchor;
  if (days[start].count === 0) start -= 1; // today isn't over yet - it does not break the streak on its own

  let current = 0;
  let lastDay: string | undefined;
  for (let i = start; i >= 0; i -= 1) {
    if (days[i].count === 0) break;
    current += 1;
    if (lastDay === undefined) lastDay = days[i].date;
  }

  return { current, longest, lastDay };
}

function sumCounts(days: DayCount[]): number {
  return days.reduce((sum, d) => sum + d.count, 0);
}

/** This-week vs last-week completion volume (two 7-day windows ending on `now`) and the trend between them. */
export function momentumFrom(days: DayCount[], now: Date = new Date()): Momentum {
  const anchor = todayIndexIn(days, now);
  const upToToday = anchor < 0 ? days : days.slice(0, anchor + 1);
  const thisWeek = sumCounts(upToToday.slice(-7));
  const lastWeek = sumCounts(upToToday.slice(-14, -7));
  const delta = thisWeek - lastWeek;
  const trend: Momentum['trend'] = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  return { thisWeek, lastWeek, delta, trend };
}
