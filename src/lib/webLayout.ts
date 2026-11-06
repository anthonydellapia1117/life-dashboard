/**
 * The web's layout, computed once and drawn as SVG by LifeWeb.tsx. Pure: no
 * React, no DOM, deterministic for a given graph and seed.
 *
 * - d3-force runs to completion synchronously, with a seeded random source and
 *   the six hubs seeded on a hexagon, so the same data always draws the same.
 * - Each node is pulled towards its bucket's hub seed, so buckets cluster.
 * - Each bucket gets a soft hull (d3.polygonHull over padded member points,
 *   drawn with curveCatmullRomClosed).
 * - Links are quadratic beziers.
 * - Labels are placed greedily (below, above, right, left), tested against
 *   every placed label, every hub pill and every node circle. Priority is
 *   hub, then section, then node. A label that fits nowhere is hidden; the
 *   view shows it on hover.
 */
import {
  curveCatmullRomClosed,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  line,
  polygonHull,
  randomLcg,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3';
import type { BucketId } from './bucket';
import type { Box } from './fit';
import type { WebGraph, WebLink, WebNode } from './lifeosGraph';

export const HUB_RING = 190;
export const LABEL_SIZE = 12;
export const LABEL_HEIGHT = 16;
export const HUB_HEIGHT = 28;
export const HULL_PAD = 16;
const LABEL_GAP = 3;

export interface PlacedNode extends WebNode {
  x: number;
  y: number;
  /** Circle radius; for a hub, half the pill height. */
  r: number;
  /** Hub pill size, hubs only. */
  w?: number;
  h?: number;
}

export interface PlacedLabel {
  id: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
}

export interface PlacedLink extends WebLink {
  d: string;
}

export interface PlacedHull {
  bucket: BucketId;
  d: string;
  points: Array<[number, number]>;
}

export interface WebLayout {
  nodes: PlacedNode[];
  links: PlacedLink[];
  hulls: PlacedHull[];
  /** Node and section labels by node id. Hubs carry their text in the pill. */
  labels: Record<string, PlacedLabel>;
  /** Node id to the ids of its direct neighbours. */
  neighbours: Record<string, string[]>;
  bounds: Box;
}

/** Text width estimate: deterministic, close enough to the system face at these sizes. */
export function textWidth(text: string, size: number, bold = false): number {
  return Math.ceil(text.length * size * (bold ? 0.6 : 0.55)) + 2;
}

export function hubText(n: Pick<WebNode, 'bucket' | 'label'>): string {
  return `${n.bucket}  ${n.label}`;
}

export function nodeRadius(n: WebNode): number {
  if (n.kind === 'hub') return HUB_HEIGHT / 2;
  if (n.kind === 'section') return 6 + Math.min(6, Math.sqrt(n.count ?? 1));
  return 6;
}

/**
 * Hub seed on the hexagon. With an aspect (stage width / height) the hexagon
 * stretches to an ellipse, so a wide stage gets a wide web
 * and a phone gets a tall one, and Fit lands near zoom 1 on both.
 */
export function hubSeed(b: BucketId, aspect = 1): [number, number] {
  const a = ((b - 1) / 6) * Math.PI * 2 - Math.PI / 2;
  const r = Math.min(2.4, Math.max(0.5, aspect));
  // Tall stages stretch fully (a phone is narrow, labels need the height); wide ones by the square root.
  const s = r < 1 ? r : Math.sqrt(r);
  return [Math.cos(a) * HUB_RING * s, Math.sin(a) * (HUB_RING / s)];
}

interface SimNode extends SimulationNodeDatum {
  id: string;
  bucket: BucketId;
  kind: WebNode['kind'];
  r: number;
  w: number;
}

type Rect = { x: number; y: number; w: number; h: number };

function rectsOverlap(a: Rect, b: Rect, gap = 2): boolean {
  return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
}

function rectHitsCircle(a: Rect, cx: number, cy: number, r: number): boolean {
  const nx = Math.max(a.x, Math.min(cx, a.x + a.w));
  const ny = Math.max(a.y, Math.min(cy, a.y + a.h));
  return (nx - cx) ** 2 + (ny - cy) ** 2 < (r + 1) ** 2;
}

function curve(sx: number, sy: number, tx: number, ty: number, bend: number): string {
  const mx = (sx + tx) / 2;
  const my = (sy + ty) / 2;
  const dx = tx - sx;
  const dy = ty - sy;
  const cx = mx - dy * bend;
  const cy = my + dx * bend;
  const f = (v: number) => Math.round(v * 10) / 10;
  return `M${f(sx)},${f(sy)} Q${f(cx)},${f(cy)} ${f(tx)},${f(ty)}`;
}

export interface LayoutOptions {
  seed?: number;
  ticks?: number;
  /** Stage width / height; 1 (the plain hexagon) when left out. */
  aspect?: number;
}

export function layoutWeb(graph: WebGraph, opts: LayoutOptions = {}): WebLayout {
  const seed = opts.seed ?? 7;
  const ticks = opts.ticks ?? 300;
  const aspect = opts.aspect ?? 1;
  const seedOf = (b: BucketId) => hubSeed(b, aspect);

  // Deterministic starting points: hubs on the hexagon, everything else on a
  // small sunflower spiral around its own hub.
  const perBucket = new Map<BucketId, number>();
  const sim: SimNode[] = graph.nodes.map((n) => {
    const [hx, hy] = seedOf(n.bucket);
    const w = n.kind === 'hub' ? textWidth(hubText(n), 13, true) + 22 : 0;
    if (n.kind === 'hub') return { id: n.id, bucket: n.bucket, kind: n.kind, r: nodeRadius(n), w, x: hx, y: hy };
    const i = (perBucket.get(n.bucket) ?? 0) + 1;
    perBucket.set(n.bucket, i);
    const a = i * 2.39996;
    const d = 30 + 9 * Math.sqrt(i);
    return { id: n.id, bucket: n.bucket, kind: n.kind, r: nodeRadius(n), w, x: hx + Math.cos(a) * d, y: hy + Math.sin(a) * d };
  });
  const byId = new Map(sim.map((n) => [n.id, n]));
  const simLinks: Array<SimulationLinkDatum<SimNode> & { kind: WebLink['kind'] }> = graph.links
    .filter((l) => byId.has(l.source) && byId.has(l.target))
    .map((l) => ({ source: l.source, target: l.target, kind: l.kind }));

  const simulation = forceSimulation<SimNode>(sim)
    .randomSource(randomLcg(seed))
    .force(
      'link',
      forceLink<SimNode, (typeof simLinks)[number]>(simLinks)
        .id((d) => d.id)
        .distance((l) => (l.kind === 'cross' ? 150 : 70))
        .strength((l) => (l.kind === 'cross' ? 0.03 : 0.5)),
    )
    .force('charge', forceManyBody<SimNode>().strength((d) => (d.kind === 'hub' ? -600 : -110)))
    .force('collide', forceCollide<SimNode>().radius((d) => (d.kind === 'hub' ? d.w * 0.42 : d.r + 14)).iterations(2))
    .force('x', forceX<SimNode>((d) => seedOf(d.bucket)[0]).strength((d) => (d.kind === 'hub' ? 0.3 : 0.1)))
    .force('y', forceY<SimNode>((d) => seedOf(d.bucket)[1]).strength((d) => (d.kind === 'hub' ? 0.3 : 0.1)))
    .stop();
  for (let i = 0; i < ticks; i++) simulation.tick();

  const nodes: PlacedNode[] = graph.nodes.map((n) => {
    const s = byId.get(n.id)!;
    const p: PlacedNode = { ...n, x: s.x ?? 0, y: s.y ?? 0, r: s.r };
    if (n.kind === 'hub') {
      p.w = s.w;
      p.h = HUB_HEIGHT;
    }
    return p;
  });
  const placed = new Map(nodes.map((n) => [n.id, n]));

  const neighbours: Record<string, string[]> = {};
  for (const n of nodes) neighbours[n.id] = [];
  const links: PlacedLink[] = [];
  for (const l of graph.links) {
    const s = placed.get(l.source);
    const t = placed.get(l.target);
    if (!s || !t) continue;
    neighbours[s.id].push(t.id);
    neighbours[t.id].push(s.id);
    const bend = l.kind === 'cross' ? (s.id < t.id ? 0.18 : -0.18) : 0.1;
    links.push({ ...l, d: curve(s.x, s.y, t.x, t.y, bend) });
  }

  // Obstacles: hub pills first, then every node circle.
  const hubRects: Rect[] = nodes
    .filter((n) => n.kind === 'hub')
    .map((n) => ({ x: n.x - n.w! / 2, y: n.y - n.h! / 2, w: n.w!, h: n.h! }));
  const circles = nodes.filter((n) => n.kind !== 'hub');
  const taken: Rect[] = [];
  const labels: Record<string, PlacedLabel> = {};
  const rank = (n: PlacedNode) => (n.kind === 'section' ? 0 : 1);
  const order = [...circles].sort(
    (a, b) => rank(a) - rank(b) || (b.count ?? 0) - (a.count ?? 0) || a.label.localeCompare(b.label) || a.id.localeCompare(b.id),
  );
  for (const n of order) {
    const w = textWidth(n.label, LABEL_SIZE);
    const h = LABEL_HEIGHT;
    const candidates: Rect[] = [
      { x: n.x - w / 2, y: n.y + n.r + LABEL_GAP, w, h },
      { x: n.x - w / 2, y: n.y - n.r - LABEL_GAP - h, w, h },
      { x: n.x + n.r + LABEL_GAP + 1, y: n.y - h / 2, w, h },
      { x: n.x - n.r - LABEL_GAP - 1 - w, y: n.y - h / 2, w, h },
    ];
    const fit = candidates.find(
      (c) =>
        !taken.some((t) => rectsOverlap(c, t)) &&
        !hubRects.some((t) => rectsOverlap(c, t)) &&
        !circles.some((o) => rectHitsCircle(c, o.x, o.y, o.r)),
    );
    const at = fit ?? candidates[0];
    if (fit) taken.push(fit);
    labels[n.id] = { id: n.id, text: n.label, x: at.x, y: at.y, w, h, visible: !!fit };
  }

  // Hulls over padded member points, one per bucket that has members.
  const hullLine = line().curve(curveCatmullRomClosed.alpha(0.5));
  const hulls: PlacedHull[] = [];
  for (const b of [1, 2, 3, 4, 5, 6] as BucketId[]) {
    const pts: Array<[number, number]> = [];
    for (const n of nodes) {
      if (n.bucket !== b) continue;
      if (n.kind === 'hub') {
        const hw = n.w! / 2 + HULL_PAD;
        const hh = n.h! / 2 + HULL_PAD;
        pts.push([n.x - hw, n.y - hh], [n.x + hw, n.y - hh], [n.x + hw, n.y + hh], [n.x - hw, n.y + hh]);
      } else {
        const pr = n.r + HULL_PAD;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          pts.push([n.x + Math.cos(a) * pr, n.y + Math.sin(a) * pr]);
        }
      }
    }
    const hull = pts.length >= 3 ? polygonHull(pts) : null;
    if (!hull) continue;
    hulls.push({ bucket: b, d: hullLine(hull) ?? '', points: hull });
  }

  // Bounds: hulls already enclose every node and pill; add visible labels and
  // a margin for the Catmull-Rom bulge between hull points.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const h of hulls) for (const [x, y] of h.points) grow(x, y);
  for (const n of nodes) {
    const hw = n.w ? n.w / 2 : n.r;
    const hh = n.h ? n.h / 2 : n.r;
    grow(n.x - hw, n.y - hh);
    grow(n.x + hw, n.y + hh);
  }
  for (const l of Object.values(labels)) {
    if (!l.visible) continue;
    grow(l.x, l.y);
    grow(l.x + l.w, l.y + l.h);
  }
  const m = 8;
  const bounds: Box = Number.isFinite(minX)
    ? { x: minX - m, y: minY - m, width: maxX - minX + m * 2, height: maxY - minY + m * 2 }
    : { x: 0, y: 0, width: 0, height: 0 };

  return { nodes, links, hulls, labels, neighbours, bounds };
}
