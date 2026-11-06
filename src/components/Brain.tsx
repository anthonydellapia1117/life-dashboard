import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildGraph, layout, neighbours, type GraphNode } from '../lib/graph';
import { fitTransform } from '../lib/fit';
import { textWidth } from '../lib/webLayout';
import { ViewControls } from './ViewControls';
import { GRADE_META, gradeClass, gradeOf } from '../lib/grade';
import { bucketOf } from '../lib/bucket';
import type { ResolvedNode } from '../lib/live';
import { GradeChip } from './GradeIcon';

/**
 * The brain: everything in the dashboard as one graph, four tiers deep -
 * Life, its zones, the areas under them, and every item hanging off an area.
 *
 * Two decisions worth stating.
 *
 * Leaves are coloured by GRADE, not by area. A second categorical palette for
 * a dozen areas would have collided with the reserved urgency ramp and left
 * two colour languages on one screen. Structure already says which area an
 * item belongs to - it is the branch it hangs from - so colour is free to say
 * the thing structure cannot: what is late. Overdue work shows up as red
 * clusters, and you can see which part of your life is carrying it.
 *
 * The layout is computed once per data change and is deterministic, seeded,
 * never animated on a loop. A graph that keeps drifting is a graph you cannot
 * point at, and it burns battery on a phone for nothing.
 */

const ZOOM_MIN = 0.35;
const ZOOM_MAX = 3;
const ZOOM_STEP = 1.25;
const FIT_PAD = 40;

interface View {
  x: number;
  y: number;
  k: number;
}

/**
 * The view that shows every node and its label, in the brain's own centre-based
 * transform: translate(W/2, H/2) scale(k) translate(x - W/2, y - H/2).
 */
function fitView(nodes: GraphNode[], width: number, height: number): View {
  if (nodes.length === 0) return { x: 0, y: 0, k: 1 };
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const n of nodes) {
    const r = radiusFor(n);
    const half = n.tier === 'item' ? r : Math.max(r, textWidth(n.label, 12, true) / 2);
    x0 = Math.min(x0, n.x - half);
    x1 = Math.max(x1, n.x + half);
    y0 = Math.min(y0, n.y - r - (n.tier === 'item' ? 0 : 20));
    y1 = Math.max(y1, n.y + r);
  }
  const t = fitTransform({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, { width, height }, FIT_PAD, {
    min: ZOOM_MIN,
    max: ZOOM_MAX,
  });
  return {
    k: t.k,
    x: (t.x - width / 2) / t.k + width / 2,
    y: (t.y - height / 2) / t.k + height / 2,
  };
}

function radiusFor(node: GraphNode): number {
  if (node.tier === 'root') return 16;
  if (node.tier === 'zone') return 11 + Math.min(6, node.degree / 4);
  if (node.tier === 'area') return 7 + Math.min(5, node.degree / 3);
  return 4.5;
}

export function Brain({ nodes, now, onOpen }: { nodes: ResolvedNode[]; now: Date; onOpen: (id: string) => void }) {
  const [selected, setSelected] = useState<string | undefined>();
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; k: number } | undefined>(undefined);
  const moved = useRef(false);

  const graph = useMemo(() => buildGraph(nodes), [nodes]);
  const placed = useMemo(() => layout(graph, { width: 900, height: 900 }), [graph]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const fitted = useMemo(() => fitView(placed.nodes, placed.width, placed.height), [placed]);
  // Start fitted, and refit when the graph itself changes.
  useEffect(() => setView(fitted), [fitted]);

  const lit = useMemo(() => {
    if (!selected) return undefined;
    return new Set([selected, ...neighbours(placed, selected)]);
  }, [placed, selected]);

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const prev = pointers.current.get(e.pointerId);
      if (!prev) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const points = [...pointers.current.values()];

      if (points.length >= 2) {
        const dist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        if (!pinch.current) {
          pinch.current = { dist, k: view.k };
        } else if (pinch.current.dist > 0) {
          const k = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, (pinch.current.k * dist) / pinch.current.dist));
          setView((v) => ({ ...v, k }));
        }
        moved.current = true;
        return;
      }

      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) moved.current = true;
      setView((v) => ({ ...v, x: v.x + dx / v.k, y: v.y + dy / v.k }));
    },
    [view.k],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = undefined;
  }, []);

  const selectedNode = selected ? byId.get(selected) : undefined;
  const selectedGraph = selected ? placed.nodes.find((n) => n.id === selected) : undefined;

  return (
    <div className="brain">
      <svg
        className="brain-canvas"
        viewBox={`0 0 ${placed.width} ${placed.height}`}
        role="application"
        aria-label="Graph of everything in the dashboard. Use the list below to reach the same items."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <g
          transform={`translate(${placed.width / 2} ${placed.height / 2}) scale(${view.k}) translate(${view.x - placed.width / 2} ${view.y - placed.height / 2})`}
        >
          <g className="brain-links">
            {placed.links.map((link) => {
              const a = placed.nodes.find((n) => n.id === link.source);
              const b = placed.nodes.find((n) => n.id === link.target);
              if (!a || !b) return null;
              const on = !lit || (lit.has(a.id) && lit.has(b.id));
              return (
                <line
                  key={`${link.source}|${link.target}`}
                  className={`brain-link${on ? '' : ' brain-dim'}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                />
              );
            })}
          </g>
          <g className="brain-nodes">
            {placed.nodes.map((gn) => {
              const item = gn.nodeId ? byId.get(gn.nodeId) : undefined;
              const grade = item ? gradeOf({ due: item.due, horizon: item.horizon, done: item.done }, now) : undefined;
              const on = !lit || lit.has(gn.id);
              const classes = [
                'brain-node',
                `brain-${gn.tier}`,
                grade ? gradeClass(grade) : '',
                on ? '' : 'brain-dim',
                selected === gn.id ? 'brain-selected' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <g key={gn.id} data-bucket={item ? bucketOf(item) : undefined}>
                  <circle
                    className={classes}
                    cx={gn.x}
                    cy={gn.y}
                    r={radiusFor(gn)}
                    onClick={() => {
                      if (moved.current) return;
                      setSelected((cur) => (cur === gn.id ? undefined : gn.id));
                    }}
                  />
                  {gn.tier !== 'item' ? (
                    <text className={`brain-label brain-label-${gn.tier}${on ? '' : ' brain-dim'}`} x={gn.x} y={gn.y - radiusFor(gn) - 5}>
                      {gn.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      <div className="brain-bar">
        <ViewControls
          onZoomOut={() => setView((v) => ({ ...v, k: Math.max(ZOOM_MIN, v.k / ZOOM_STEP) }))}
          onFit={() => setView(fitted)}
          onZoomIn={() => setView((v) => ({ ...v, k: Math.min(ZOOM_MAX, v.k * ZOOM_STEP) }))}
          zoomLabel={`${Math.round(view.k * 100)}%`}
        >
          <button type="button" className="btn-tinted" onClick={() => setView({ x: 0, y: 0, k: 1 })}>
            Reset view
          </button>
        </ViewControls>
        <span className="brain-stat">
          {placed.nodes.length} nodes, {placed.links.length} links
        </span>
      </div>

      {selectedGraph ? (
        <div className="brain-detail">
          <div className="brain-detail-head">
            <h3 className="brain-detail-title">{selectedGraph.label}</h3>
            <button type="button" className="btn btn-quiet" onClick={() => setSelected(undefined)}>
              Clear
            </button>
          </div>
          {selectedNode ? (
            <>
              <p className="brain-detail-meta">
                <GradeChip
                  grade={gradeOf(
                    {
                      due: selectedNode.due,
                      horizon: selectedNode.horizon,
                      done: selectedNode.done,
                    },
                    now,
                  )}
                />
                <span className="node-area">{selectedNode.area}</span>
              </p>
              {selectedNode.detail ? <p className="brain-detail-body">{selectedNode.detail}</p> : null}
              <button type="button" className="btn btn-primary" onClick={() => onOpen(selectedNode.id)}>
                Open
              </button>
            </>
          ) : (
            <p className="brain-detail-meta">
              {selectedGraph.degree} connection
              {selectedGraph.degree === 1 ? '' : 's'}
            </p>
          )}
        </div>
      ) : (
        <p className="caption">
          Tap a dot to light up what it touches. Drag to move, pinch to zoom. Colour is when something is due, not what it is:{' '}
          {GRADE_META.overdue.label.toLowerCase()} and {GRADE_META.today.label.toLowerCase()} are red.
        </p>
      )}
    </div>
  );
}
