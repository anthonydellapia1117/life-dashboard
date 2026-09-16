import { describe, expect, it } from 'vitest';
import { roadmapByMonth, roadmapLanes, spanDays } from '../src/lib/roadmap';
import type { LifeNode } from '../src/lib/nodes';

// Fixed "today" - Saturday, 2026-01-10. A 6-month default window from here
// runs Jan through Jun 2026, so anything in Jul 2026 or later is "someday".
const TODAY = new Date(2026, 0, 10);

function node(id: string, overrides: Partial<LifeNode> = {}): LifeNode {
  return {
    id,
    rawId: id,
    source: 'test',
    kind: 'action',
    title: `Item ${id}`,
    area: 'Area A',
    zone: 'Zone A',
    baseDone: false,
    ...overrides,
  };
}

describe('roadmapByMonth bucketing', () => {
  const FIXTURE: LifeNode[] = [
    node('overdue1', { title: 'Overdue one', due: '2026-01-05' }),
    node('today1', { title: 'Today one', due: '2026-01-10' }),
    node('jan-future', { title: 'Jan future', due: '2026-01-20' }),
    node('mar1', { title: 'Mar one', due: '2026-03-15' }),
    node('jun1', { title: 'Jun one', due: '2026-06-30' }),
    node('past-window', { title: 'Past window', due: '2026-08-01' }),
    node('undated', { title: 'Undated' }),
  ];

  it('produces overdue, six month buckets, then someday, in that order', () => {
    const buckets = roadmapByMonth(FIXTURE, TODAY);
    expect(buckets.map((b) => b.key)).toEqual([
      'overdue', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', 'someday',
    ]);
  });

  it('labels months as "Mon YYYY", and overdue/someday with their words', () => {
    const buckets = roadmapByMonth(FIXTURE, TODAY);
    const byKey = (key: string) => buckets.find((b) => b.key === key)!;
    expect(byKey('overdue').label).toBe('Overdue');
    expect(byKey('2026-01').label).toBe('Jan 2026');
    expect(byKey('2026-06').label).toBe('Jun 2026');
    expect(byKey('someday').label).toBe('No date');
  });

  it('puts a due-today item in the current month bucket, not overdue', () => {
    const buckets = roadmapByMonth(FIXTURE, TODAY);
    const jan = buckets.find((b) => b.key === '2026-01')!;
    expect(jan.items.map((i) => i.nodeId)).toEqual(['today1', 'jan-future']);
  });

  it('keeps empty months as a visible gap in the window', () => {
    const buckets = roadmapByMonth(FIXTURE, TODAY);
    const feb = buckets.find((b) => b.key === '2026-02')!;
    const apr = buckets.find((b) => b.key === '2026-04')!;
    expect(feb.items).toEqual([]);
    expect(apr.items).toEqual([]);
  });

  it('collects undated nodes and nodes due past the window into someday, undated first', () => {
    const buckets = roadmapByMonth(FIXTURE, TODAY);
    const someday = buckets.find((b) => b.key === 'someday')!;
    expect(someday.items.map((i) => i.nodeId)).toEqual(['undated', 'past-window']);
  });

  it('omits the overdue bucket entirely when nothing is overdue', () => {
    const noOverdue = FIXTURE.filter((n) => n.id !== 'overdue1');
    const buckets = roadmapByMonth(noOverdue, TODAY);
    expect(buckets.map((b) => b.key)).not.toContain('overdue');
  });

  it('omits the someday bucket entirely when everything is dated within the window', () => {
    const inWindowOnly = [
      node('a', { title: 'A', due: '2026-01-12' }),
      node('b', { title: 'B', due: '2026-05-01' }),
    ];
    const buckets = roadmapByMonth(inWindowOnly, TODAY);
    expect(buckets.map((b) => b.key)).not.toContain('someday');
  });

  it('sorts same-due items by title ascending', () => {
    const tied = [
      node('z', { title: 'Zebra task', due: '2026-02-01' }),
      node('a', { title: 'Alpha task', due: '2026-02-01' }),
    ];
    const buckets = roadmapByMonth(tied, TODAY);
    const feb = buckets.find((b) => b.key === '2026-02')!;
    expect(feb.items.map((i) => i.nodeId)).toEqual(['a', 'z']);
  });

  it('respects a custom months window', () => {
    const buckets = roadmapByMonth(FIXTURE, TODAY, 2);
    // Jan and Feb only; Mar onward (mar1, jun1) now fall past the window into someday.
    expect(buckets.map((b) => b.key)).toEqual(['overdue', '2026-01', '2026-02', 'someday']);
    const someday = buckets.find((b) => b.key === 'someday')!;
    expect(someday.items.map((i) => i.nodeId)).toEqual(
      expect.arrayContaining(['undated', 'mar1', 'jun1', 'past-window']),
    );
  });

  it('defaults to a 6-month window when months is not passed', () => {
    const buckets = roadmapByMonth(FIXTURE, TODAY);
    const monthKeys = buckets.filter((b) => b.key !== 'overdue' && b.key !== 'someday');
    expect(monthKeys).toHaveLength(6);
  });
});

describe('roadmapLanes', () => {
  const FIXTURE: LifeNode[] = [
    node('a1', { area: 'Area A', due: '2026-01-05' }), // overdue
    node('a2', { area: 'Area A', due: '2026-01-20' }), // Jan
    node('a3', { area: 'Area A' }), // someday (undated)
    node('b1', { area: 'Area B', due: '2026-03-01' }), // Mar
    node('c1', { title: 'C first', area: 'Area C', due: '2026-01-15' }), // Jan
    node('c2', { title: 'C second', area: 'Area C', due: '2026-01-16' }), // Jan
  ];

  it('sorts lanes by item count descending, then area name ascending', () => {
    const lanes = roadmapLanes(FIXTURE, TODAY);
    // Area A: 3 items, Area C: 2 items, Area B: 1 item.
    expect(lanes.map((l) => l.area)).toEqual(['Area A', 'Area C', 'Area B']);
  });

  it('gives every lane the same bucket keys, in the same order, as the overall roadmap', () => {
    const overall = roadmapByMonth(FIXTURE, TODAY);
    const overallKeys = overall.map((b) => b.key);
    const lanes = roadmapLanes(FIXTURE, TODAY);
    expect(lanes).toHaveLength(3);
    for (const lane of lanes) {
      expect(lane.buckets.map((b) => b.key)).toEqual(overallKeys);
      expect(lane.buckets.map((b) => b.label)).toEqual(overall.map((b) => b.label));
    }
  });

  it('keeps a bucket present (empty) for a lane with nothing in it, when the overall roadmap has that bucket', () => {
    const lanes = roadmapLanes(FIXTURE, TODAY);
    const areaC = lanes.find((l) => l.area === 'Area C')!;
    // Area C has no overdue and no someday items, but overall does - the
    // bucket keys must still be present, just empty, for grid alignment.
    expect(areaC.buckets.find((b) => b.key === 'overdue')!.items).toEqual([]);
    expect(areaC.buckets.find((b) => b.key === 'someday')!.items).toEqual([]);
    expect(areaC.buckets.find((b) => b.key === '2026-01')!.items.map((i) => i.nodeId)).toEqual(['c1', 'c2']);
  });

  it('routes each area only its own items into the shared bucket shape', () => {
    const lanes = roadmapLanes(FIXTURE, TODAY);
    const areaA = lanes.find((l) => l.area === 'Area A')!;
    expect(areaA.buckets.find((b) => b.key === 'overdue')!.items.map((i) => i.nodeId)).toEqual(['a1']);
    expect(areaA.buckets.find((b) => b.key === '2026-01')!.items.map((i) => i.nodeId)).toEqual(['a2']);
    expect(areaA.buckets.find((b) => b.key === 'someday')!.items.map((i) => i.nodeId)).toEqual(['a3']);

    const areaB = lanes.find((l) => l.area === 'Area B')!;
    expect(areaB.buckets.find((b) => b.key === '2026-03')!.items.map((i) => i.nodeId)).toEqual(['b1']);
  });
});

describe('spanDays', () => {
  it('is zero width with no dated nodes at all', () => {
    const result = spanDays([node('u1'), node('u2')], TODAY);
    expect(result).toEqual({ days: 0 });
  });

  it('is zero width with exactly one dated node, but still reports that date', () => {
    const result = spanDays([node('u1'), node('d1', { due: '2026-01-05' })], TODAY);
    expect(result).toEqual({ firstISO: '2026-01-05', lastISO: '2026-01-05', days: 0 });
  });

  it('spans from the earliest to the latest due date across three dated nodes, order-independent', () => {
    const nodes = [
      node('mid', { due: '2026-01-20' }),
      node('first', { due: '2026-01-05' }),
      node('last', { due: '2026-02-04' }),
    ];
    const result = spanDays(nodes, TODAY);
    expect(result).toEqual({ firstISO: '2026-01-05', lastISO: '2026-02-04', days: 30 });
  });
});

describe('finished work is never late', () => {
  it('keeps a done item out of the overdue bucket and in its own month', () => {
    const buckets = roadmapByMonth([node('a', { due: '2026-01-05', baseDone: true })], TODAY);
    expect(buckets.find((b) => b.key === 'overdue')).toBeUndefined();
    expect(buckets.find((b) => b.key === '2026-01')?.items.map((i) => i.nodeId)).toEqual(['a']);
  });

  it('prefers the live done flag over the sealed row when the overlay disagrees', () => {
    const resolved = { ...node('a', { due: '2026-01-05', baseDone: false }), done: true };
    const buckets = roadmapByMonth([resolved], TODAY);
    expect(buckets.find((b) => b.key === 'overdue')).toBeUndefined();

    const reopened = { ...node('b', { due: '2026-01-05', baseDone: true }), done: false };
    expect(roadmapByMonth([reopened], TODAY).find((b) => b.key === 'overdue')?.items).toHaveLength(1);
  });

  it('still reports unfinished past work as overdue', () => {
    const buckets = roadmapByMonth([node('a', { due: '2026-01-05' })], TODAY);
    expect(buckets.find((b) => b.key === 'overdue')?.items.map((i) => i.nodeId)).toEqual(['a']);
  });

  it('agrees with the board about the same item', () => {
    const done = { ...node('a', { due: '2026-01-05', baseDone: true }), done: true };
    const late = { ...node('b', { due: '2026-01-05', baseDone: false }), done: false };
    const buckets = roadmapByMonth([done, late], TODAY);
    expect(buckets.find((b) => b.key === 'overdue')?.items.map((i) => i.nodeId)).toEqual(['b']);
  });
});
