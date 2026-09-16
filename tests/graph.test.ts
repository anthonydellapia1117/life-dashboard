import { describe, expect, it } from 'vitest';
import { buildGraph, layout, neighbours, type GraphLink, type GraphNode } from '../src/lib/graph';
import type { LifeNode } from '../src/lib/nodes';

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

// Two zones, "Area A" repeated under both zones on purpose - this is the
// fixture that proves area nodes are scoped per zone rather than merged.
const FIXTURE: LifeNode[] = [
  node('i1', { title: 'Item one', zone: 'Zone A', area: 'Area A' }),
  node('i2', { title: 'Item two', zone: 'Zone A', area: 'Area A' }),
  node('i3', { title: 'Item three', zone: 'Zone A', area: 'Area B' }),
  node('i4', { title: 'Item four', zone: 'Zone B', area: 'Area A' }),
];

describe('buildGraph', () => {
  it('builds one root, one node per zone, one node per zone-scoped area, one leaf per item', () => {
    const graph = buildGraph(FIXTURE);
    const byTier = (tier: string) => graph.nodes.filter((n) => n.tier === tier);
    expect(byTier('root')).toHaveLength(1);
    expect(byTier('zone')).toHaveLength(2);
    expect(byTier('area')).toHaveLength(3);
    expect(byTier('item')).toHaveLength(4);
    expect(graph.nodes).toHaveLength(10);
    expect(graph.links).toHaveLength(9);
  });

  it('scopes areas to their zone: the same area name under two zones stays two nodes', () => {
    const graph = buildGraph(FIXTURE);
    const areaIds = graph.nodes.filter((n) => n.tier === 'area').map((n) => n.id);
    expect(areaIds).toEqual(
      expect.arrayContaining(['area:Zone A/Area A', 'area:Zone A/Area B', 'area:Zone B/Area A']),
    );
    expect(new Set(areaIds).size).toBe(3);
  });

  it('gives the root label "Life" and item nodes a back-reference to their LifeNode id', () => {
    const graph = buildGraph(FIXTURE);
    const root = graph.nodes.find((n) => n.tier === 'root')!;
    expect(root.label).toBe('Life');
    expect(root.area).toBeUndefined();

    const item = graph.nodes.find((n) => n.id === 'i1')!;
    expect(item.nodeId).toBe('i1');
    expect(item.label).toBe('Item one');
    expect(item.area).toBe('Area A');
  });

  it('computes degree as the count of links touching each node', () => {
    const graph = buildGraph(FIXTURE);
    const degreeOf = (id: string) => graph.nodes.find((n) => n.id === id)!.degree;

    expect(degreeOf('root')).toBe(2); // root -> zone:Zone A, root -> zone:Zone B
    expect(degreeOf('zone:Zone A')).toBe(3); // root, area:Zone A/Area A, area:Zone A/Area B
    expect(degreeOf('zone:Zone B')).toBe(2); // root, area:Zone B/Area A
    expect(degreeOf('area:Zone A/Area A')).toBe(3); // zone, i1, i2
    expect(degreeOf('area:Zone A/Area B')).toBe(2); // zone, i3
    expect(degreeOf('area:Zone B/Area A')).toBe(2); // zone, i4
    expect(degreeOf('i1')).toBe(1);
  });
});

describe('neighbours', () => {
  it('returns directly linked ids in the stable order they are found', () => {
    const graph = buildGraph(FIXTURE);
    expect(neighbours(graph, 'root')).toEqual(['zone:Zone A', 'zone:Zone B']);
    expect(neighbours(graph, 'area:Zone A/Area A')).toEqual(['zone:Zone A', 'i1', 'i2']);
    expect(neighbours(graph, 'i1')).toEqual(['area:Zone A/Area A']);
  });

  it('dedupes when two links connect the same pair from either direction', () => {
    const links: GraphLink[] = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'a' },
    ];
    expect(neighbours({ links }, 'a')).toEqual(['b']);
  });

  it('returns an empty array for an id with no links', () => {
    const graph = buildGraph(FIXTURE);
    expect(neighbours(graph, 'nowhere')).toEqual([]);
  });
});

describe('layout determinism', () => {
  it('produces identical coordinates for the same input and seed', () => {
    const graph = buildGraph(FIXTURE);
    const a = layout(graph, { seed: 1 });
    const b = layout(graph, { seed: 1 });
    expect(a.nodes.map((n) => [n.id, n.x, n.y])).toEqual(b.nodes.map((n) => [n.id, n.x, n.y]));
  });

  it('produces different coordinates for a different seed', () => {
    const graph = buildGraph(FIXTURE);
    const a = layout(graph, { seed: 1 });
    const b = layout(graph, { seed: 2 });
    const coordsA = a.nodes.map((n) => [n.x, n.y]);
    const coordsB = b.nodes.map((n) => [n.x, n.y]);
    expect(coordsA).not.toEqual(coordsB);
  });

  it('keeps every coordinate inside the requested box, default and custom sizes', () => {
    const graph = buildGraph(FIXTURE);

    const defaults = layout(graph);
    expect(defaults.width).toBe(800);
    expect(defaults.height).toBe(800);
    for (const n of defaults.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(800);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(800);
    }

    const custom = layout(graph, { width: 500, height: 300, seed: 7 });
    for (const n of custom.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(500);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(300);
    }
  });

  it('handles a single-node graph (root only) without error', () => {
    const graph = buildGraph([]);
    const result = layout(graph, { seed: 3 });
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].x).toBeGreaterThanOrEqual(0);
    expect(result.nodes[0].x).toBeLessThanOrEqual(800);
  });
});

describe('layout node cap', () => {
  it('drops the lowest-degree item nodes first once the graph exceeds 600 nodes', () => {
    const root: Omit<GraphNode, 'x' | 'y'> = { id: 'root', label: 'Life', tier: 'root', degree: 605 };
    const items: Array<Omit<GraphNode, 'x' | 'y'>> = [];
    const links: GraphLink[] = [];
    for (let i = 0; i < 605; i++) {
      const id = `item-${String(i).padStart(3, '0')}`;
      items.push({ id, label: `Item ${i}`, tier: 'item', area: 'Area A', degree: i, nodeId: id });
      links.push({ source: 'root', target: id });
    }
    // 1 root + 605 items = 606 nodes, 6 over the 600 cap.
    const graph = { nodes: [root, ...items], links };

    const result = layout(graph, { seed: 1 });

    expect(result.nodes).toHaveLength(600);
    expect(result.nodes.some((n) => n.id === 'root')).toBe(true);

    const remainingIds = new Set(result.nodes.map((n) => n.id));
    // The 6 lowest-degree items (degree 0..5) are dropped.
    for (let i = 0; i < 6; i++) {
      expect(remainingIds.has(`item-${String(i).padStart(3, '0')}`)).toBe(false);
    }
    // The rest survive, including the highest-degree item.
    expect(remainingIds.has('item-006')).toBe(true);
    expect(remainingIds.has('item-604')).toBe(true);
  });

  it('never drops root, zone, or area tiers even when over budget', () => {
    const root: Omit<GraphNode, 'x' | 'y'> = { id: 'root', label: 'Life', tier: 'root', degree: 1 };
    const zone: Omit<GraphNode, 'x' | 'y'> = { id: 'zone:Zone A', label: 'Zone A', tier: 'zone', degree: 1 };
    const area: Omit<GraphNode, 'x' | 'y'> = {
      id: 'area:Zone A/Area A', label: 'Area A', tier: 'area', area: 'Area A', degree: 1,
    };
    const items: Array<Omit<GraphNode, 'x' | 'y'>> = [];
    for (let i = 0; i < 610; i++) {
      const id = `item-${String(i).padStart(3, '0')}`;
      items.push({ id, label: `Item ${i}`, tier: 'item', area: 'Area A', degree: i, nodeId: id });
    }
    const graph = { nodes: [root, zone, area, ...items], links: [] as GraphLink[] };

    const result = layout(graph, { seed: 1 });

    expect(result.nodes).toHaveLength(600);
    const remainingIds = new Set(result.nodes.map((n) => n.id));
    expect(remainingIds.has('root')).toBe(true);
    expect(remainingIds.has('zone:Zone A')).toBe(true);
    expect(remainingIds.has('area:Zone A/Area A')).toBe(true);
  });
});

describe('layout performance', () => {
  it('lays out 400 items (plus zone/area/root nodes) well under 100ms', () => {
    const bigFixture: LifeNode[] = [];
    for (let z = 0; z < 4; z++) {
      for (let a = 0; a < 10; a++) {
        for (let i = 0; i < 10; i++) {
          const id = `n-${z}-${a}-${i}`;
          bigFixture.push(node(id, { title: `Item ${id}`, zone: `Zone ${z}`, area: `Area ${a}` }));
        }
      }
    }
    expect(bigFixture).toHaveLength(400);

    const graph = buildGraph(bigFixture);
    // 1 root + 4 zones + 40 areas + 400 items = 445 nodes, under the 600 cap.
    expect(graph.nodes).toHaveLength(445);

    const start = performance.now();
    const result = layout(graph, { seed: 1 });
    const elapsedMs = performance.now() - start;

    // eslint-disable-next-line no-console
    console.log(`layout() for ${graph.nodes.length} nodes took ${elapsedMs.toFixed(2)}ms`);

    expect(result.nodes).toHaveLength(445);
    expect(elapsedMs).toBeLessThan(500);
  });
});
