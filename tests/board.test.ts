import { describe, expect, it } from 'vitest';
import { boardColumns, dueForGrade, sortColumn } from '../src/lib/board';
import { gradeOf } from '../src/lib/grade';
import type { ResolvedNode } from '../src/lib/live';

const TUE = new Date(2020, 0, 7); // Tuesday; this week runs to Sunday the 12th

function node(id: string, over: Partial<ResolvedNode> = {}): ResolvedNode {
  return {
    id, rawId: id, source: 'test', kind: 'action',
    title: `Item ${id}`, area: 'Area A', zone: 'work', section: 'engagement',
    baseDone: false, done: false, edited: false, archived: false, created: false,
    ...over,
  };
}

describe('dueForGrade', () => {
  it('turns a column into a real date, never a relative word', () => {
    expect(dueForGrade('overdue', TUE)).toBe('2020-01-06');
    expect(dueForGrade('today', TUE)).toBe('2020-01-07');
    expect(dueForGrade('tomorrow', TUE)).toBe('2020-01-08');
    expect(dueForGrade('thisWeek', TUE)).toBe('2020-01-12');
    expect(dueForGrade('nextWeek', TUE)).toBe('2020-01-19');
    expect(dueForGrade('later', TUE)).toBe('2020-02-06');
  });

  it('clears the date for someday and leaves done to the checkbox', () => {
    expect(dueForGrade('someday', TUE)).toBeNull();
    expect(dueForGrade('done', TUE)).toBeUndefined();
  });

  it('round-trips: the date a column sets grades back into that same column', () => {
    for (const grade of ['overdue', 'today', 'tomorrow', 'thisWeek', 'nextWeek', 'later'] as const) {
      const due = dueForGrade(grade, TUE);
      expect(gradeOf({ due: due ?? undefined, done: false }, TUE)).toBe(grade);
    }
  });

  it('does not collapse this week into tomorrow on a Saturday', () => {
    const SAT = new Date(2020, 0, 11);
    expect(dueForGrade('thisWeek', SAT)).toBe('2020-01-13');
    expect(dueForGrade('tomorrow', SAT)).toBe('2020-01-12');
  });
});

describe('sortColumn', () => {
  it('puts the earliest date first and the undated last', () => {
    const items = [node('c'), node('a', { due: '2020-03-01' }), node('b', { due: '2020-01-09' })];
    expect(sortColumn(items).map((n) => n.id)).toEqual(['b', 'a', 'c']);
  });

  it('breaks a tie on title, so the order never wobbles between renders', () => {
    const items = [node('z', { title: 'Zebra' }), node('a', { title: 'Apple' })];
    expect(sortColumn(items).map((n) => n.title)).toEqual(['Apple', 'Zebra']);
  });

  it('does not mutate its input', () => {
    const items = [node('b', { due: '2020-03-01' }), node('a', { due: '2020-01-09' })];
    sortColumn(items);
    expect(items.map((n) => n.id)).toEqual(['b', 'a']);
  });
});

describe('boardColumns', () => {
  it('keeps every column, empty ones included, so the board does not reshuffle as work lands', () => {
    const columns = boardColumns([node('a', { due: '2020-01-07' })], TUE);
    expect(columns.map((c) => c.grade)).toEqual([
      'overdue', 'today', 'tomorrow', 'thisWeek', 'nextWeek', 'later', 'done',
    ]);
    expect(columns.find((c) => c.grade === 'today')?.items).toHaveLength(1);
    expect(columns.find((c) => c.grade === 'overdue')?.items).toHaveLength(0);
  });

  it('shows the no-date column only when it holds something, just before Done', () => {
    const columns = boardColumns([node('a'), node('b', { due: '2020-01-07' })], TUE);
    const keys = columns.map((c) => c.grade);
    expect(keys.indexOf('someday')).toBe(keys.indexOf('done') - 1);
    expect(columns.find((c) => c.grade === 'someday')?.items).toHaveLength(1);
  });

  it('files a finished item under Done whatever its date says', () => {
    const columns = boardColumns([node('a', { due: '2019-01-01', done: true })], TUE);
    expect(columns.find((c) => c.grade === 'done')?.items.map((n) => n.id)).toEqual(['a']);
    expect(columns.find((c) => c.grade === 'overdue')?.items).toHaveLength(0);
  });

  it('files every item exactly once', () => {
    const nodes = [
      node('a', { due: '2020-01-01' }), node('b', { due: '2020-01-07' }),
      node('c', { due: '2020-01-08' }), node('d', { due: '2020-01-12' }),
      node('e', { due: '2020-01-15' }), node('f', { due: '2020-02-20' }),
      node('g'), node('h', { done: true }),
    ];
    const columns = boardColumns(nodes, TUE);
    const placed = columns.flatMap((c) => c.items.map((n) => n.id));
    expect(placed).toHaveLength(nodes.length);
    expect(new Set(placed).size).toBe(nodes.length);
  });

  it('renders an empty board without throwing', () => {
    expect(boardColumns([], TUE).every((c) => c.items.length === 0)).toBe(true);
  });
});
