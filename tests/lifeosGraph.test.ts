import { describe, expect, it } from 'vitest';
import { buildWeb, hubId, sectionCounts } from '../src/lib/lifeosGraph';

describe('buildWeb', () => {
  it('always has the six hubs, even with no data', () => {
    const g = buildWeb(undefined);
    expect(g.nodes.filter((n) => n.kind === 'hub').map((n) => n.bucket)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(g.links).toEqual([]);
  });

  it('spokes each node to its hub and resolves cross links by label, dropping unknowns and duplicates', () => {
    const g = buildWeb({
      nodes: [
        { label: 'Alpha', bucket: 1 },
        { label: 'Beta', bucket: 4 },
        { label: 'Bad', bucket: 9 },
      ],
      links: [
        ['Alpha', 'Beta'],
        ['beta', 'alpha'],
        ['Alpha', 'Nowhere'],
      ],
    });
    expect(g.nodes.map((n) => n.label)).not.toContain('Bad');
    const spokes = g.links.filter((l) => l.kind === 'spoke');
    expect(spokes).toEqual([
      { source: 'n:alpha', target: hubId(1), kind: 'spoke' },
      { source: 'n:beta', target: hubId(4), kind: 'spoke' },
    ]);
    expect(g.links.filter((l) => l.kind === 'cross')).toHaveLength(1);
  });

  it('adds one node per section with open items, on that section bucket', () => {
    const counts = sectionCounts([
      { section: 'finances' },
      { section: 'finances' },
      { section: 'family', done: true },
      {},
    ]);
    expect(counts).toEqual([{ section: 'finances', open: 2 }]);
    const g = buildWeb(undefined, counts);
    const s = g.nodes.find((n) => n.kind === 'section');
    expect(s?.bucket).toBe(5);
    expect(s?.count).toBe(2);
  });
});
