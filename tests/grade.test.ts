import { describe, expect, it } from 'vitest';
import {
  BOARD_GRADES,
  GRADE_META,
  GRADE_ORDER,
  compareByGrade,
  daysToEndOfWeek,
  gradeClass,
  gradeOf,
  isPressing,
} from '../src/lib/grade';

// A Tuesday, so "this week" runs to Sunday the 5th and has real width.
const TUE = new Date(2020, 0, 7);
const SAT = new Date(2020, 0, 11);
const SUN = new Date(2020, 0, 12);

function on(due: string | undefined, extra: { horizon?: string; done?: boolean } = {}) {
  return { due, horizon: extra.horizon, done: extra.done ?? false };
}

describe('daysToEndOfWeek', () => {
  it('counts to the coming Sunday', () => {
    expect(daysToEndOfWeek(TUE)).toBe(5);
    expect(daysToEndOfWeek(SAT)).toBe(1);
  });

  it('is zero on a Sunday, which is already the end of the week', () => {
    expect(daysToEndOfWeek(SUN)).toBe(0);
  });
});

describe('gradeOf by date', () => {
  it('grades the whole ramp from one Tuesday', () => {
    expect(gradeOf(on('2020-01-06'), TUE)).toBe('overdue');
    expect(gradeOf(on('2020-01-07'), TUE)).toBe('today');
    expect(gradeOf(on('2020-01-08'), TUE)).toBe('tomorrow');
    expect(gradeOf(on('2020-01-12'), TUE)).toBe('thisWeek'); // the coming Sunday
    expect(gradeOf(on('2020-01-13'), TUE)).toBe('nextWeek'); // the Monday after
    expect(gradeOf(on('2020-01-19'), TUE)).toBe('nextWeek'); // that week's Sunday
    expect(gradeOf(on('2020-01-20'), TUE)).toBe('later');
    expect(gradeOf(on('2020-04-06'), TUE)).toBe('later'); // day 90
    expect(gradeOf(on('2020-04-07'), TUE)).toBe('someday'); // day 91
  });

  it('leaves no gap on a Saturday, when this week has nowhere left to run', () => {
    expect(gradeOf(on('2020-01-12'), SAT)).toBe('tomorrow');
    expect(gradeOf(on('2020-01-13'), SAT)).toBe('nextWeek');
    expect(gradeOf(on('2020-01-19'), SAT)).toBe('nextWeek');
    expect(gradeOf(on('2020-01-20'), SAT)).toBe('later');
  });

  it('leaves no gap on a Sunday either', () => {
    expect(gradeOf(on('2020-01-12'), SUN)).toBe('today');
    expect(gradeOf(on('2020-01-13'), SUN)).toBe('tomorrow');
    expect(gradeOf(on('2020-01-19'), SUN)).toBe('nextWeek');
  });

  it('ignores an unparseable date and falls through to the horizon', () => {
    expect(gradeOf({ due: 'next Tuesday', horizon: 'now', done: false }, TUE)).toBe('today');
    expect(gradeOf({ due: 'soon', done: false }, TUE)).toBe('someday');
  });
});

describe('gradeOf without a date', () => {
  it('reads the horizon', () => {
    expect(gradeOf(on(undefined, { horizon: 'now' }), TUE)).toBe('today');
    expect(gradeOf(on(undefined, { horizon: 'week' }), TUE)).toBe('thisWeek');
    expect(gradeOf(on(undefined, { horizon: 'later' }), TUE)).toBe('later');
    expect(gradeOf(on(undefined, { horizon: 'routine' }), TUE)).toBe('someday');
  });

  it('falls back to someday for an absent or unknown horizon', () => {
    expect(gradeOf(on(undefined), TUE)).toBe('someday');
    expect(gradeOf(on(undefined, { horizon: 'whenever' }), TUE)).toBe('someday');
  });
});

describe('done', () => {
  it('wins over any date, so finished work is never reported late', () => {
    expect(gradeOf(on('2019-01-01', { done: true }), TUE)).toBe('done');
    expect(gradeOf(on('2020-01-07', { done: true }), TUE)).toBe('done');
    expect(gradeOf(on(undefined, { horizon: 'now', done: true }), TUE)).toBe('done');
  });
});

describe('the vocabulary itself', () => {
  it('describes every grade exactly once, ranked in GRADE_ORDER', () => {
    expect(GRADE_ORDER).toHaveLength(8);
    expect(new Set(GRADE_ORDER).size).toBe(8);
    GRADE_ORDER.forEach((grade, i) => {
      expect(GRADE_META[grade].rank).toBe(i);
    });
  });

  it('gives every grade a word and an icon, so colour is never carrying it alone', () => {
    for (const grade of GRADE_ORDER) {
      expect(GRADE_META[grade].label.length).toBeGreaterThan(0);
      expect(GRADE_META[grade].short.length).toBeGreaterThan(0);
      expect(GRADE_META[grade].icon.length).toBeGreaterThan(0);
      expect(GRADE_META[grade].token.startsWith('--grade-')).toBe(true);
    }
  });

  it('gives every grade a distinct colour token and class', () => {
    const tokens = GRADE_ORDER.map((g) => GRADE_META[g].token);
    expect(new Set(tokens).size).toBe(tokens.length);
    const classes = GRADE_ORDER.map(gradeClass);
    expect(new Set(classes).size).toBe(classes.length);
  });

  it('puts every board grade in the ramp, and folds someday away', () => {
    for (const grade of BOARD_GRADES) expect(GRADE_ORDER).toContain(grade);
    expect(BOARD_GRADES).not.toContain('someday');
  });

  it('treats only overdue and today as pressing', () => {
    expect(GRADE_ORDER.filter(isPressing)).toEqual(['overdue', 'today']);
  });
});

describe('compareByGrade', () => {
  it('sorts by urgency, then by date, then by title', () => {
    const items = [
      { title: 'later one', due: '2020-06-01', done: false },
      { title: 'b today', due: '2020-01-07', done: false },
      { title: 'a today', due: '2020-01-07', done: false },
      { title: 'overdue', due: '2020-01-01', done: false },
      { title: 'finished', due: '2020-01-01', done: true },
    ];
    expect([...items].sort((a, b) => compareByGrade(a, b, TUE)).map((i) => i.title)).toEqual([
      'overdue',
      'a today',
      'b today',
      'later one',
      'finished',
    ]);
  });

  it('sorts a dated item ahead of an undated one at the same grade', () => {
    const dated = { title: 'z dated', due: '2020-04-01', done: false };
    const undated = { title: 'a undated', horizon: 'later', done: false };
    expect(compareByGrade(dated, undated, TUE)).toBeLessThan(0);
    expect(compareByGrade(undated, dated, TUE)).toBeGreaterThan(0);
  });
});
