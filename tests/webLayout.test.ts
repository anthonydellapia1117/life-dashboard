import { describe, expect, it } from 'vitest';
import { polygonContains } from 'd3';
import { buildWeb, type LifeOsData } from '../src/lib/lifeosGraph';
import { fitTransform } from '../src/lib/fit';
import { layoutWeb } from '../src/lib/webLayout';

const data: LifeOsData = {
  nodes: [
    { label: 'Morning run', bucket: 1 },
    { label: 'Reading list', bucket: 1 },
    { label: 'Dentist', bucket: 1 },
    { label: 'Birthday plan', bucket: 2 },
    { label: 'Photo backup', bucket: 2 },
    { label: 'Recruiter calls', bucket: 3 },
    { label: 'Meetup group', bucket: 3 },
    { label: 'Side build', bucket: 4 },
    { label: 'Landing page', bucket: 4 },
    { label: 'Tax return', bucket: 5 },
    { label: 'Mortgage', bucket: 5 },
    { label: 'Streaming plans', bucket: 5 },
    { label: 'Engagement plan', bucket: 6 },
    { label: 'Status deck', bucket: 6 },
    { label: 'Architecture review', bucket: 6 },
  ],
  links: [
    ['Side build', 'Landing page'],
    ['Tax return', 'Mortgage'],
    ['Recruiter calls', 'Engagement plan'],
  ],
};
const graph = buildWeb(data, [
  { section: 'engagement', open: 5 },
  { section: 'family', open: 2 },
  { section: 'finances', open: 3 },
]);

describe('layoutWeb', () => {
  it('is deterministic for the same seed', () => {
    const a = layoutWeb(graph, { seed: 3 });
    const b = layoutWeb(graph, { seed: 3 });
    expect(a.nodes.map((n) => [n.id, n.x, n.y])).toEqual(b.nodes.map((n) => [n.id, n.x, n.y]));
    expect(a.labels).toEqual(b.labels);
    expect(a.hulls.map((h) => h.d)).toEqual(b.hulls.map((h) => h.d));
  });

  it('places every node and gives every non-hub a label record', () => {
    const l = layoutWeb(graph);
    expect(l.nodes).toHaveLength(graph.nodes.length);
    for (const n of l.nodes) {
      expect(Number.isFinite(n.x) && Number.isFinite(n.y)).toBe(true);
      if (n.kind !== 'hub') expect(l.labels[n.id]).toBeDefined();
    }
    expect(l.links).toHaveLength(graph.links.length);
    for (const link of l.links) expect(link.d).toMatch(/^M[-\d.]+,[-\d.]+ Q/);
  });

  it('never overlaps two visible labels, and keeps visible labels off hub pills', () => {
    const l = layoutWeb(graph);
    const vis = Object.values(l.labels).filter((x) => x.visible);
    expect(vis.length).toBeGreaterThan(0);
    for (let i = 0; i < vis.length; i++) {
      for (let j = i + 1; j < vis.length; j++) {
        const a = vis[i];
        const b = vis[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `${a.text} overlaps ${b.text}`).toBe(false);
      }
    }
    for (const hub of l.nodes.filter((n) => n.kind === 'hub')) {
      const hx = hub.x - hub.w! / 2;
      const hy = hub.y - hub.h! / 2;
      for (const a of vis) {
        const overlap = a.x < hx + hub.w! && hx < a.x + a.w && a.y < hy + hub.h! && hy < a.y + a.h;
        expect(overlap, `${a.text} sits on hub ${hub.label}`).toBe(false);
      }
    }
  });

  it('puts every node inside the fitted viewport', () => {
    const l = layoutWeb(graph);
    for (const vp of [
      { width: 1100, height: 560 },
      { width: 358, height: 440 },
    ]) {
      const t = fitTransform(l.bounds, vp, 16, { min: 0.2, max: 3 });
      for (const n of l.nodes) {
        const hw = (n.w ? n.w / 2 : n.r) * t.k;
        const sx = n.x * t.k + t.x;
        const sy = n.y * t.k + t.y;
        expect(sx - hw).toBeGreaterThanOrEqual(0);
        expect(sx + hw).toBeLessThanOrEqual(vp.width);
        expect(sy).toBeGreaterThanOrEqual(0);
        expect(sy).toBeLessThanOrEqual(vp.height);
      }
    }
  });

  it('wraps each bucket hull around all of its members', () => {
    const l = layoutWeb(graph);
    expect(l.hulls.map((h) => h.bucket)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const h of l.hulls) {
      expect(h.d.startsWith('M')).toBe(true);
      for (const n of l.nodes.filter((x) => x.bucket === h.bucket)) {
        expect(polygonContains(h.points, [n.x, n.y]), `${n.label} outside hull ${h.bucket}`).toBe(true);
      }
    }
  });

  it('stretches to the stage: a wide stage gives a wide web, a tall one a tall web', () => {
    const wide = layoutWeb(graph, { aspect: 2 }).bounds;
    const tall = layoutWeb(graph, { aspect: 0.7 }).bounds;
    expect(wide.width / wide.height).toBeGreaterThan(tall.width / tall.height);
    expect(tall.height).toBeGreaterThan(tall.width * 0.9);
  });

  it('records neighbours both ways and copes with an empty data set', () => {
    const l = layoutWeb(graph);
    const side = l.nodes.find((n) => n.label === 'Side build')!;
    const page = l.nodes.find((n) => n.label === 'Landing page')!;
    expect(l.neighbours[side.id]).toContain(page.id);
    expect(l.neighbours[page.id]).toContain(side.id);

    const bare = layoutWeb(buildWeb(undefined));
    expect(bare.nodes).toHaveLength(6);
    expect(bare.hulls).toHaveLength(6);
    expect(bare.bounds.width).toBeGreaterThan(0);
  });
});
