import { describe, expect, it } from 'vitest';
import {
  completedBetween,
  completionsByDay,
  countBy,
  countNodes,
  countsByArea,
  countsBySection,
  countsByZone,
  type ResolvedNode,
} from '../src/lib/progress';

// Fixture builder - fictional ids/titles/areas only, never real data.
function node(id: string, overrides: Partial<ResolvedNode> = {}): ResolvedNode {
  return {
    id,
    rawId: id,
    source: 'test',
    kind: 'action',
    title: `Item ${id}`,
    area: 'Area A',
    zone: 'life',
    baseDone: false,
    done: false,
    ...overrides,
  };
}

describe('countNodes', () => {
  it('gives pct 0, not NaN, for a zero total', () => {
    expect(countNodes([])).toEqual({ total: 0, done: 0, left: 0, pct: 0 });
  });

  it('counts total/done/left and rounds pct to an integer', () => {
    const nodes = [node('a', { done: true }), node('b', { done: false }), node('c', { done: false })];
    expect(countNodes(nodes)).toEqual({ total: 3, done: 1, left: 2, pct: 33 });
  });

  it('rounds pct up when past the half', () => {
    const nodes = [node('a', { done: true }), node('b', { done: true }), node('c', { done: false })];
    expect(countNodes(nodes).pct).toBe(67); // 2/3 = 66.67 -> 67
  });

  it('reads 100 when every node is done', () => {
    const nodes = [node('a', { done: true }), node('b', { done: true })];
    expect(countNodes(nodes)).toEqual({ total: 2, done: 2, left: 0, pct: 100 });
  });
});

describe('countBy', () => {
  it('orders keys by first appearance, not alphabetically or by size', () => {
    const nodes = [
      node('a', { area: 'Area B' }),
      node('b', { area: 'Area A' }),
      node('c', { area: 'Area B' }),
      node('d', { area: 'Area C' }),
      node('e', { area: 'Area A' }),
    ];
    const byArea = countBy(nodes, (n) => n.area);
    expect([...byArea.keys()]).toEqual(['Area B', 'Area A', 'Area C']);
    expect(byArea.get('Area B')).toEqual({ total: 2, done: 0, left: 2, pct: 0 });
    expect(byArea.get('Area A')).toEqual({ total: 2, done: 0, left: 2, pct: 0 });
    expect(byArea.get('Area C')).toEqual({ total: 1, done: 0, left: 1, pct: 0 });
  });

  it('counts each group independently, including done/pct per group', () => {
    const nodes = [
      node('a', { area: 'Area A', done: true }),
      node('b', { area: 'Area A', done: false }),
      node('c', { area: 'Area B', done: true }),
    ];
    const byArea = countBy(nodes, (n) => n.area);
    expect(byArea.get('Area A')).toEqual({ total: 2, done: 1, left: 1, pct: 50 });
    expect(byArea.get('Area B')).toEqual({ total: 1, done: 1, left: 0, pct: 100 });
  });
});

describe('countsByArea / countsByZone / countsBySection', () => {
  it('countsByArea groups on the area field', () => {
    const nodes = [node('a', { area: 'Area A' }), node('b', { area: 'Area B' })];
    expect([...countsByArea(nodes).keys()]).toEqual(['Area A', 'Area B']);
  });

  it('countsByZone groups on the zone field', () => {
    const nodes = [node('a', { zone: 'work' }), node('b', { zone: 'life' })];
    expect([...countsByZone(nodes).keys()]).toEqual(['work', 'life']);
  });

  it('countsBySection keys on "zone/section", with an empty suffix when section is absent', () => {
    const nodes = [
      node('a', { zone: 'life', section: 'Home' }),
      node('b', { zone: 'life' }),
      node('c', { zone: 'work', section: 'Client A' }),
    ];
    const bySection = countsBySection(nodes);
    expect([...bySection.keys()]).toEqual(['life/Home', 'life/', 'work/Client A']);
  });
});

describe('completedBetween', () => {
  it('includes done nodes whose doneAt date falls inside the range, inclusive of both ends', () => {
    const nodes = [
      node('start', { done: true, doneAt: '2020-01-05' }),
      node('mid', { done: true, doneAt: '2020-01-07' }),
      node('end', { done: true, doneAt: '2020-01-10' }),
      node('before', { done: true, doneAt: '2020-01-04' }),
      node('after', { done: true, doneAt: '2020-01-11' }),
    ];
    const inRange = completedBetween(nodes, '2020-01-05', '2020-01-10');
    expect(inRange.map((n) => n.id)).toEqual(['start', 'mid', 'end']);
  });

  it('excludes nodes that are not done, or done but missing a doneAt', () => {
    const nodes = [
      node('not-done', { done: false, doneAt: '2020-01-06' }),
      node('no-timestamp', { done: true }),
      node('done', { done: true, doneAt: '2020-01-06' }),
    ];
    const inRange = completedBetween(nodes, '2020-01-01', '2020-01-31');
    expect(inRange.map((n) => n.id)).toEqual(['done']);
  });

  it('compares only the date part, so a full timestamp still matches its day', () => {
    const nodes = [node('a', { done: true, doneAt: '2020-01-06T23:45:00Z' })];
    expect(completedBetween(nodes, '2020-01-06', '2020-01-06')).toHaveLength(1);
    expect(completedBetween(nodes, '2020-01-07', '2020-01-07')).toHaveLength(0);
  });
});

describe('completionsByDay', () => {
  it('returns exactly `days` entries, zero-filled, when nothing is done', () => {
    const now = new Date(2020, 0, 10);
    const result = completionsByDay([], 5, now);
    expect(result).toHaveLength(5);
    expect(result.every((d) => d.count === 0)).toBe(true);
  });

  it('ends on today, oldest first', () => {
    const now = new Date(2020, 0, 10);
    const result = completionsByDay([], 3, now);
    expect(result.map((d) => d.date)).toEqual(['2020-01-08', '2020-01-09', '2020-01-10']);
  });

  it('counts a completion on its own local calendar day', () => {
    const now = new Date(2020, 0, 10);
    const nodes = [
      node('a', { done: true, doneAt: new Date(2020, 0, 9, 8, 0, 0).toISOString() }),
      node('b', { done: true, doneAt: new Date(2020, 0, 9, 20, 0, 0).toISOString() }),
      node('c', { done: false, doneAt: new Date(2020, 0, 9, 12, 0, 0).toISOString() }),
    ];
    const result = completionsByDay(nodes, 3, now);
    const jan9 = result.find((d) => d.date === '2020-01-09');
    expect(jan9?.count).toBe(2); // "not done" is excluded even though it carries a doneAt
  });

  it('buckets a late-evening completion under its own local day, not a shifted UTC day', () => {
    const now = new Date(2020, 0, 10, 9, 0, 0); // local Jan 10, morning
    const lateEvening = new Date(2020, 0, 9, 23, 45, 0).toISOString(); // local Jan 9, 11:45pm
    const nodes = [node('a', { done: true, doneAt: lateEvening })];
    const result = completionsByDay(nodes, 3, now);
    expect(result.find((d) => d.date === '2020-01-09')?.count).toBe(1);
    expect(result.find((d) => d.date === '2020-01-10')?.count).toBe(0);
  });
});
