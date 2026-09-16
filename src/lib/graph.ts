/**
 * Force-directed knowledge graph ("obsidian brain" style) over the life
 * data. Three tiers hang off a single root: root -> zone -> area -> item,
 * where "item" leaves are the individual LifeNode records.
 *
 * Everything here is a pure function. `layout` runs a small deterministic
 * force simulation (repulsion + spring links + mild centring) seeded with
 * a tiny mulberry32 PRNG instead of Math.random, so the same input always
 * produces the same coordinates.
 */

import type { LifeNode } from './nodes';

export type GraphNodeTier = 'root' | 'zone' | 'area' | 'item';

export interface GraphNode {
  id: string;
  label: string;
  tier: GraphNodeTier;
  /** The area this node belongs to - drives colour. Root has undefined. */
  area?: string;
  /** Number of links touching this node. Drives radius. */
  degree: number;
  /** Back-reference to the LifeNode for tier 'item'. */
  nodeId?: string;
  x: number;
  y: number;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphLayout {
  nodes: GraphNode[];
  links: GraphLink[];
  width: number;
  height: number;
}

type BuiltGraph = { nodes: Array<Omit<GraphNode, 'x' | 'y'>>; links: GraphLink[] };

const ROOT_ID = 'root';

function zoneId(zone: string): string {
  return `zone:${zone}`;
}

function areaId(zone: string, area: string): string {
  return `area:${zone}/${area}`;
}

/**
 * Builds the three-tier graph (root, one node per zone, one node per area
 * scoped to its zone, one leaf per LifeNode) plus root->zone, zone->area
 * and area->item links. Degree is the count of links touching each node.
 *
 * Areas are scoped to their zone (`area:<zone>/<area>`) so the same area
 * name under two different zones produces two distinct area nodes.
 */
export function buildGraph(nodes: LifeNode[]): BuiltGraph {
  const zoneOrder: string[] = [];
  const zoneSeen = new Set<string>();
  const areaOrder: string[] = [];
  const areaSeen = new Set<string>();
  const areaZoneOf = new Map<string, string>();
  const areaNameOf = new Map<string, string>();

  for (const node of nodes) {
    if (!zoneSeen.has(node.zone)) {
      zoneSeen.add(node.zone);
      zoneOrder.push(node.zone);
    }
    const id = areaId(node.zone, node.area);
    if (!areaSeen.has(id)) {
      areaSeen.add(id);
      areaOrder.push(id);
      areaZoneOf.set(id, node.zone);
      areaNameOf.set(id, node.area);
    }
  }

  const links: GraphLink[] = [];
  for (const zone of zoneOrder) links.push({ source: ROOT_ID, target: zoneId(zone) });
  for (const id of areaOrder) links.push({ source: zoneId(areaZoneOf.get(id)!), target: id });
  for (const node of nodes) links.push({ source: areaId(node.zone, node.area), target: node.id });

  const degree = new Map<string, number>();
  const touch = (id: string) => degree.set(id, (degree.get(id) ?? 0) + 1);
  for (const link of links) {
    touch(link.source);
    touch(link.target);
  }

  const graphNodes: Array<Omit<GraphNode, 'x' | 'y'>> = [];
  graphNodes.push({ id: ROOT_ID, label: 'Life', tier: 'root', degree: degree.get(ROOT_ID) ?? 0 });
  for (const zone of zoneOrder) {
    const id = zoneId(zone);
    graphNodes.push({ id, label: zone, tier: 'zone', degree: degree.get(id) ?? 0 });
  }
  for (const id of areaOrder) {
    const name = areaNameOf.get(id)!;
    graphNodes.push({ id, label: name, tier: 'area', area: name, degree: degree.get(id) ?? 0 });
  }
  for (const node of nodes) {
    graphNodes.push({
      id: node.id,
      label: node.title,
      tier: 'item',
      area: node.area,
      degree: degree.get(node.id) ?? 0,
      nodeId: node.id,
    });
  }

  return { nodes: graphNodes, links };
}

/** Tiny seeded PRNG (mulberry32) - deterministic stand-in for Math.random. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hard cap so a very large dataset cannot blow up the O(n^2) simulation. */
const MAX_LAYOUT_NODES = 600;

/**
 * Drops the lowest-degree item-tier nodes (never root/zone/area) until the
 * node count is at or under `maxNodes`. Ties break on id ascending, so the
 * result is deterministic for a given input.
 */
function capToBudget(
  nodes: Array<Omit<GraphNode, 'x' | 'y'>>,
  links: GraphLink[],
  maxNodes: number,
): BuiltGraph {
  if (nodes.length <= maxNodes) return { nodes, links };

  const overBudget = nodes.length - maxNodes;
  const items = nodes.filter((node) => node.tier === 'item');
  const droppable = [...items].sort((a, b) => {
    if (a.degree !== b.degree) return a.degree - b.degree;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const dropIds = new Set(droppable.slice(0, Math.min(overBudget, droppable.length)).map((n) => n.id));

  const keptNodes = nodes.filter((node) => !dropIds.has(node.id));
  const keptLinks = links.filter((link) => !dropIds.has(link.source) && !dropIds.has(link.target));

  const degree = new Map<string, number>();
  const touch = (id: string) => degree.set(id, (degree.get(id) ?? 0) + 1);
  for (const link of keptLinks) {
    touch(link.source);
    touch(link.target);
  }

  return {
    nodes: keptNodes.map((node) => ({ ...node, degree: degree.get(node.id) ?? 0 })),
    links: keptLinks,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface LayoutOptions {
  width?: number;
  height?: number;
  iterations?: number;
  seed?: number;
}

/**
 * A simple deterministic force simulation: O(n^2) pairwise repulsion,
 * spring attraction along links, a mild centring pull, and a seeded PRNG
 * for the initial placement. Coordinates are clamped into the box at the
 * end. Node count is capped at 600 (see `capToBudget`) before simulating.
 */
export function layout(graph: BuiltGraph, opts?: LayoutOptions): GraphLayout {
  const width = opts?.width ?? 800;
  const height = opts?.height ?? 800;
  const iterations = opts?.iterations ?? 220;
  const seed = opts?.seed ?? 1;

  const { nodes: keptNodes, links: keptLinks } = capToBudget(graph.nodes, graph.links, MAX_LAYOUT_NODES);
  const n = keptNodes.length;

  const rng = mulberry32(seed);
  const indexOf = new Map<string, number>();
  keptNodes.forEach((node, i) => indexOf.set(node.id, i));

  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    xs[i] = rng() * width;
    ys[i] = rng() * height;
  }

  const linkPairs: Array<{ a: number; b: number }> = [];
  for (const link of keptLinks) {
    const a = indexOf.get(link.source);
    const b = indexOf.get(link.target);
    if (a !== undefined && b !== undefined) linkPairs.push({ a, b });
  }

  if (n > 1) {
    const area = width * height;
    const k = Math.sqrt(area / n);
    const cx = width / 2;
    const cy = height / 2;
    const dispX = new Float64Array(n);
    const dispY = new Float64Array(n);

    for (let iter = 0; iter < iterations; iter++) {
      dispX.fill(0);
      dispY.fill(0);

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          let dx = xs[i] - xs[j];
          let dy = ys[i] - ys[j];
          let dist2 = dx * dx + dy * dy;
          if (dist2 < 0.0001) {
            // Deterministic nudge apart - avoids a division by zero without
            // reaching for any source of randomness.
            dx = 0.01 + (i % 7) * 0.001;
            dy = 0.01 + (j % 5) * 0.001;
            dist2 = dx * dx + dy * dy;
          }
          const dist = Math.sqrt(dist2);
          const force = (k * k) / dist;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          dispX[i] += fx;
          dispY[i] += fy;
          dispX[j] -= fx;
          dispY[j] -= fy;
        }
      }

      for (const { a, b } of linkPairs) {
        const dx = xs[a] - xs[b];
        const dy = ys[a] - ys[b];
        const dist = Math.max(0.01, Math.sqrt(dx * dx + dy * dy));
        const force = (dist * dist) / k;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        dispX[a] -= fx;
        dispY[a] -= fy;
        dispX[b] += fx;
        dispY[b] += fy;
      }

      // Gravity has to be able to answer repulsion, which grows as k^2/dist.
      // At 0.01 it could not, and the graph expanded until every node was
      // pinned to the frame. Scaled by k, it holds the cluster together.
      const gravity = k * 0.012;
      for (let i = 0; i < n; i++) {
        dispX[i] += (cx - xs[i]) * gravity * 0.02;
        dispY[i] += (cy - ys[i]) * gravity * 0.02;
      }

      const temperature = Math.max(0.01, 1 - iter / iterations) * (k * 0.5);
      for (let i = 0; i < n; i++) {
        const dx = dispX[i];
        const dy = dispY[i];
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const capped = Math.min(dist, temperature);
        // Clamp every iteration, not once at the end. Clamping only on the
        // way out turns anything that drifted off-frame into a row of nodes
        // stacked along the edge.
        xs[i] = clamp(xs[i] + (dx / dist) * capped, 0, width);
        ys[i] = clamp(ys[i] + (dy / dist) * capped, 0, height);
      }
    }
  }

  // Fit the settled cloud to the frame: find its bounding box and map it into
  // the canvas with a margin, one scale for both axes so nothing is squashed.
  // Generous enough to hold a node's own radius and the label drawn above it,
  // so nothing on the rim gets sliced off by the frame.
  const margin = Math.min(width, height) * 0.13;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    if (xs[i] < minX) minX = xs[i];
    if (xs[i] > maxX) maxX = xs[i];
    if (ys[i] < minY) minY = ys[i];
    if (ys[i] > maxY) maxY = ys[i];
  }
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const scale = n > 1 && spanX > 0.001 && spanY > 0.001
    ? Math.min((width - 2 * margin) / spanX, (height - 2 * margin) / spanY)
    : 1;
  // Centre whatever is left over, so a tall graph is not shoved against one side.
  const offsetX = (width - spanX * scale) / 2 - minX * scale;
  const offsetY = (height - spanY * scale) / 2 - minY * scale;

  const outNodes: GraphNode[] = keptNodes.map((node, i) => ({
    ...node,
    x: n > 1 ? clamp(xs[i] * scale + offsetX, 0, width) : width / 2,
    y: n > 1 ? clamp(ys[i] * scale + offsetY, 0, height) : height / 2,
  }));

  return { nodes: outNodes, links: keptLinks, width, height };
}

/** Ids directly linked to `id`, deduped, in the stable order they are found. */
export function neighbours(graph: { links: GraphLink[] }, id: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const link of graph.links) {
    let other: string | undefined;
    if (link.source === id) other = link.target;
    else if (link.target === id) other = link.source;
    if (other !== undefined && !seen.has(other)) {
      seen.add(other);
      result.push(other);
    }
  }
  return result;
}
