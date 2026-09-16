import { describe, expect, it } from 'vitest';
import { XP_BY_GRADE, levelFor, momentumFrom, streakFrom, xpFor } from '../src/lib/game';

interface DayCount {
  date: string;
  count: number;
}

// Builds a run of consecutive local-calendar-day entries starting at `base`
// (a fictional "YYYY-MM-DD"), one per count in `counts`, oldest first - the
// same shape completionsByDay returns.
function buildDays(base: string, counts: number[]): DayCount[] {
  const [y, m, d] = base.split('-').map(Number);
  return counts.map((count, i) => {
    const dt = new Date(y, m - 1, d + i);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return { date: `${yyyy}-${mm}-${dd}`, count };
  });
}

// "now" lands on the last entry of a built day list, so it always plays the
// role of "today" in streakFrom/momentumFrom.
function nowFor(days: DayCount[]): Date {
  const last = days[days.length - 1];
  const [y, m, d] = last.date.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

describe('XP_BY_GRADE / xpFor', () => {
  it('exposes the spec value for every grade', () => {
    expect(XP_BY_GRADE).toEqual({
      overdue: 12,
      today: 10,
      tomorrow: 8,
      thisWeek: 6,
      nextWeek: 4,
      later: 2,
      someday: 1,
      done: 0,
    });
  });

  it('xpFor reads the same table', () => {
    expect(xpFor('overdue')).toBe(12);
    expect(xpFor('today')).toBe(10);
    expect(xpFor('tomorrow')).toBe(8);
    expect(xpFor('thisWeek')).toBe(6);
    expect(xpFor('nextWeek')).toBe(4);
    expect(xpFor('later')).toBe(2);
    expect(xpFor('someday')).toBe(1);
    expect(xpFor('done')).toBe(0);
  });
});

describe('levelFor', () => {
  it('starts at level 1, title Starting, with 0 xp', () => {
    expect(levelFor(0)).toEqual({ level: 1, title: 'Starting', xpIntoLevel: 0, xpForNextLevel: 50, pct: 0 });
  });

  it('tracks partial progress just below the next level boundary', () => {
    const level = levelFor(49);
    expect(level.level).toBe(1);
    expect(level.xpIntoLevel).toBe(49);
    expect(level.xpForNextLevel).toBe(50);
    expect(level.pct).toBe(98); // 49/50 -> 98%
  });

  it('advances exactly one level at the xp boundary, resetting progress into it', () => {
    expect(levelFor(50)).toEqual({ level: 2, title: 'Steady', xpIntoLevel: 0, xpForNextLevel: 100, pct: 0 });
  });

  it('keeps climbing at a deep level, with a growing xp requirement per level', () => {
    const level = levelFor(2500);
    expect(level.level).toBe(10);
    expect(level.xpIntoLevel).toBe(250);
    expect(level.xpForNextLevel).toBe(500);
    expect(level.pct).toBe(50);
  });

  it('holds on the last title past the roster length instead of cycling back', () => {
    expect(levelFor(1050).title).toBe('Relentless'); // level 7 - last named title
    expect(levelFor(1400).title).toBe('Relentless'); // level 8 - stays put, does not wrap
  });
});

describe('streakFrom', () => {
  it('keeps the streak alive when today is empty but yesterday is not', () => {
    const days = buildDays('2020-01-05', [1, 1, 0]); // two done days, then an empty today
    const streak = streakFrom(days, nowFor(days));
    expect(streak.current).toBe(2);
    expect(streak.longest).toBe(2);
    expect(streak.lastDay).toBe(days[1].date);
  });

  it('breaks the current streak when the day two days back from today is empty', () => {
    const days = buildDays('2020-01-05', [1, 1, 0, 1, 1]); // zero two days back from today
    const streak = streakFrom(days, nowFor(days));
    expect(streak.current).toBe(2);
    expect(streak.longest).toBe(2);
    expect(streak.lastDay).toBe(days[4].date);
  });

  it('reports the longest run even when it happened earlier than the current one', () => {
    const days = buildDays('2020-01-01', [1, 1, 1, 1, 0, 1]); // a 4-day run, a gap, then today alone
    const streak = streakFrom(days, nowFor(days));
    expect(streak.current).toBe(1);
    expect(streak.longest).toBe(4);
    expect(streak.lastDay).toBe(days[5].date);
  });

  it('reads all zero as no streak and no last day', () => {
    const days = buildDays('2020-01-01', [0, 0, 0]);
    expect(streakFrom(days, nowFor(days))).toEqual({ current: 0, longest: 0, lastDay: undefined });
  });

  it('reads an unbroken window as current === longest === window length', () => {
    const days = buildDays('2020-01-01', [1, 1, 1, 1]);
    const streak = streakFrom(days, nowFor(days));
    expect(streak.current).toBe(4);
    expect(streak.longest).toBe(4);
    expect(streak.lastDay).toBe(days[3].date);
  });
});

describe('momentumFrom', () => {
  it('flags an upward trend when this week beats last week', () => {
    const days = buildDays('2020-01-01', [...Array(7).fill(1), ...Array(7).fill(2)]);
    const momentum = momentumFrom(days, nowFor(days));
    expect(momentum.lastWeek).toBe(7);
    expect(momentum.thisWeek).toBe(14);
    expect(momentum.delta).toBe(7);
    expect(momentum.trend).toBe('up');
  });

  it('flags a downward trend when this week falls behind last week', () => {
    const days = buildDays('2020-01-01', [...Array(7).fill(2), ...Array(7).fill(1)]);
    const momentum = momentumFrom(days, nowFor(days));
    expect(momentum.lastWeek).toBe(14);
    expect(momentum.thisWeek).toBe(7);
    expect(momentum.delta).toBe(-7);
    expect(momentum.trend).toBe('down');
  });

  it('flags flat when this week matches last week exactly, including a zero/zero tie', () => {
    const days = buildDays('2020-01-01', [...Array(7).fill(1), ...Array(7).fill(1)]);
    const momentum = momentumFrom(days, nowFor(days));
    expect(momentum.delta).toBe(0);
    expect(momentum.trend).toBe('flat');

    const emptyDays = buildDays('2020-01-01', new Array(14).fill(0));
    expect(momentumFrom(emptyDays, nowFor(emptyDays)).trend).toBe('flat');
  });
});
