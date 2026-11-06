import { describe, expect, it } from 'vitest';
import { bucketOf, countByBucket } from '../src/lib/bucket';
import { kpiCounts, quadrantOf, weekStrip } from '../src/lib/eisenhower';

// Friday 2026-11-06, local.
const NOW = new Date(2026, 10, 6);

describe('bucketOf', () => {
  it('honours an explicit bucket', () => {
    expect(bucketOf({ bucket: 4, title: 'Pay mortgage' })).toBe(4);
  });
  it('infers from words, first rule wins', () => {
    expect(bucketOf({ title: 'Pay mortgage' })).toBe(5);
    expect(bucketOf({ area: 'Work', title: 'Client review' })).toBe(6);
    expect(bucketOf({ title: 'Ayvede pitch' })).toBe(4);
    expect(bucketOf({ title: 'Update resume' })).toBe(3);
    expect(bucketOf({ title: 'Andi birthday' })).toBe(2);
    expect(bucketOf({ title: 'Stretch' })).toBe(1);
  });
  it('does not match inside longer words', () => {
    expect(bucketOf({ title: 'Networking coffee' })).toBe(3);
  });
  it('falls back to the section, then to Me', () => {
    expect(bucketOf({ title: 'Thing', section: 'finances' })).toBe(5);
    expect(bucketOf({ title: 'Thing' })).toBe(1);
  });
  it('counts every bucket', () => {
    const c = countByBucket([{ title: 'a' }, { title: 'Pay bill' }]);
    expect(c[1]).toBe(1);
    expect(c[5]).toBe(1);
    expect(c[6]).toBe(0);
  });
});

describe('quadrantOf', () => {
  it('urgent and important -> do', () => {
    expect(quadrantOf({ title: 'Pay bill', due: '2026-11-08', done: false }, NOW)).toBe('do');
  });
  it('overdue counts as urgent', () => {
    expect(quadrantOf({ title: 'Pay bill', due: '2026-11-01', done: false }, NOW)).toBe('do');
  });
  it('important but not urgent -> schedule', () => {
    expect(quadrantOf({ title: 'Pay bill', due: '2026-12-20', done: false }, NOW)).toBe('schedule');
  });
  it('urgent flag without importance -> delegate', () => {
    expect(quadrantOf({ title: 'Stretch', urgent: true, done: false }, NOW)).toBe('delegate');
  });
  it('neither -> drop', () => {
    expect(quadrantOf({ title: 'Stretch', done: false }, NOW)).toBe('drop');
  });
  it('important flag -> schedule', () => {
    expect(quadrantOf({ title: 'Stretch', important: true, done: false }, NOW)).toBe('schedule');
  });
});

describe('kpiCounts', () => {
  it('counts real items', () => {
    const k = kpiCounts(
      [
        { title: 'a', due: '2026-11-01', done: false },
        { title: 'b', due: '2026-11-08', done: false },
        { title: 'c', due: '2026-11-20', done: false },
        { title: 'd', done: false },
        { title: 'e', due: '2026-11-01', done: true },
      ],
      NOW,
    );
    expect(k).toEqual({ open: 4, dueThisWeek: 1, overdue: 1 });
  });
});

describe('weekStrip', () => {
  it('returns seven days from today and places entries', () => {
    const s = weekStrip([{ date: '2026-11-08', title: 'Example: x', bucket: 2 }, { bad: true }], NOW);
    expect(s).toHaveLength(7);
    expect(s[0].isToday).toBe(true);
    expect(s[2].entries).toHaveLength(1);
  });
  it('tolerates a non-array', () => {
    expect(weekStrip(undefined, NOW)).toHaveLength(7);
  });
});
