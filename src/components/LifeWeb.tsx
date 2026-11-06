import { useEffect, useRef, useState } from 'react';
import type { BucketId } from '../lib/bucket';
import type { WebGraph, WebNode } from '../lib/lifeosGraph';

/**
 * The web: a d3-force graph on a canvas (d3 loaded on demand). Hubs are the
 * six buckets; nodes come from the sealed Life OS data. Drag a node, wheel or
 * pinch to zoom, hover for a tooltip, click a hub to set the global filter.
 * Labels: hubs always, nodes past zoom 1.35, on hover, or with Labels on.
 */
interface SimNode extends WebNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}
interface SimLink {
  source: SimNode | string;
  target: SimNode | string;
  kind: 'spoke' | 'cross';
}

const LABEL_ZOOM = 1.35;

function radius(n: WebNode): number {
  if (n.kind === 'hub') return 17;
  if (n.kind === 'section') return 5 + Math.min(5, Math.sqrt(n.count ?? 1));
  return 6;
}

function tokens() {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fb: string) => s.getPropertyValue(name).trim() || fb;
  return {
    label: v('--label', '#000'),
    label2: v('--label-2', 'rgba(60,60,67,.6)'),
    sep: v('--separator', 'rgba(60,60,67,.29)'),
    card: v('--card', '#fff'),
    gray: v('--gray', '#8e8e93'),
    font: v('--font-sans', 'system-ui, sans-serif'),
    bucket: [1, 2, 3, 4, 5, 6].map((i) => v(`--bucket-${i}`, '#8e8e93')),
  };
}

export function LifeWeb({
  graph,
  selected,
  onSelect,
}: {
  graph: WebGraph;
  selected: BucketId | null;
  onSelect: (id: BucketId) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [labels, setLabels] = useState(false);
  const [failed, setFailed] = useState(false);
  const api = useRef<{ fit: () => void; redraw: () => void } | null>(null);
  const live = useRef({ selected, labels, onSelect });
  live.current = { selected, labels, onSelect };

  useEffect(() => {
    api.current?.redraw();
  }, [selected, labels]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    let disposed = false;
    let cleanup = () => {};

    import('d3')
      .then((d3) => {
        if (disposed) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setFailed(true);
          return;
        }
        const nodes: SimNode[] = graph.nodes.map((n) => ({ ...n }));
        const links: SimLink[] = graph.links.map((l) => ({ ...l }));
        let width = host.clientWidth || 600;
        let height = host.clientHeight || 480;
        // Hubs start on a hexagon so the six neighbourhoods settle apart.
        nodes.forEach((n) => {
          if (n.kind === 'hub') {
            const a = ((n.bucket - 1) / 6) * Math.PI * 2 - Math.PI / 2;
            n.x = Math.cos(a) * 200;
            n.y = Math.sin(a) * 200;
          }
        });

        let transform = d3.zoomIdentity;
        let hovered: SimNode | null = null;
        let theme = tokens();

        function size() {
          width = host!.clientWidth || 600;
          height = host!.clientHeight || 480;
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          canvas!.width = Math.round(width * dpr);
          canvas!.height = Math.round(height * dpr);
          canvas!.style.width = `${width}px`;
          canvas!.style.height = `${height}px`;
          ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function inBucket(n: SimNode) {
          const sel = live.current.selected;
          return sel === null || n.bucket === sel;
        }

        function draw() {
          const { selected: sel, labels: showAll } = live.current;
          ctx!.save();
          ctx!.clearRect(0, 0, width, height);
          ctx!.translate(width / 2 + transform.x, height / 2 + transform.y);
          ctx!.scale(transform.k, transform.k);

          for (const l of links) {
            const s = l.source as SimNode;
            const t = l.target as SimNode;
            if (s.x === undefined || t.x === undefined) continue;
            const on = sel === null || (s.bucket === sel && t.bucket === sel);
            const hot = hovered && (s === hovered || t === hovered);
            ctx!.globalAlpha = on ? (hot ? 0.95 : l.kind === 'cross' ? 0.75 : 0.5) : 0.08;
            ctx!.strokeStyle = l.kind === 'cross' && on ? theme.bucket[s.bucket - 1] : theme.sep;
            ctx!.lineWidth = (l.kind === 'cross' ? 1.4 : 1) / Math.sqrt(transform.k);
            if (l.kind === 'cross') ctx!.setLineDash([4 / transform.k, 3 / transform.k]);
            else ctx!.setLineDash([]);
            ctx!.beginPath();
            ctx!.moveTo(s.x, s.y!);
            ctx!.lineTo(t.x, t.y!);
            ctx!.stroke();
          }
          ctx!.setLineDash([]);

          for (const n of nodes) {
            if (n.x === undefined) continue;
            const on = inBucket(n);
            const r = radius(n);
            const color = on ? theme.bucket[n.bucket - 1] : theme.gray;
            ctx!.globalAlpha = on ? 1 : 0.15;
            ctx!.beginPath();
            ctx!.arc(n.x, n.y!, r, 0, Math.PI * 2);
            if (n.kind === 'section') {
              ctx!.fillStyle = theme.card;
              ctx!.fill();
              ctx!.lineWidth = 2;
              ctx!.strokeStyle = color;
              ctx!.stroke();
            } else {
              ctx!.fillStyle = color;
              ctx!.fill();
              ctx!.lineWidth = n.kind === 'hub' ? 3 : 1.5;
              ctx!.strokeStyle = theme.card;
              ctx!.stroke();
            }
            if (sel !== null && on) {
              ctx!.beginPath();
              ctx!.arc(n.x, n.y!, r + 3, 0, Math.PI * 2);
              ctx!.lineWidth = 2 / transform.k;
              ctx!.strokeStyle = theme.bucket[n.bucket - 1];
              ctx!.stroke();
            }
            if (n.kind === 'hub') {
              ctx!.fillStyle = '#fff';
              ctx!.font = `700 ${13}px ${theme.font}`;
              ctx!.textAlign = 'center';
              ctx!.textBaseline = 'middle';
              ctx!.fillText(String(n.bucket), n.x, n.y! + 0.5);
            }
            const showLabel = n.kind === 'hub' || showAll || transform.k > LABEL_ZOOM || hovered === n;
            if (showLabel) {
              const fs = n.kind === 'hub' ? 13 : 11;
              ctx!.font = `${n.kind === 'hub' ? 600 : 400} ${fs / Math.max(1, transform.k * 0.8)}px ${theme.font}`;
              ctx!.textAlign = 'center';
              ctx!.textBaseline = 'top';
              ctx!.fillStyle = n.kind === 'hub' ? theme.label : theme.label2;
              ctx!.fillText(n.label, n.x, n.y! + r + 4);
            }
          }
          ctx!.restore();
          ctx!.globalAlpha = 1;
        }

        function toGraph(px: number, py: number): [number, number] {
          return [(px - width / 2 - transform.x) / transform.k, (py - height / 2 - transform.y) / transform.k];
        }
        function find(px: number, py: number): SimNode | null {
          const [gx, gy] = toGraph(px, py);
          let best: SimNode | null = null;
          let bestD = Infinity;
          for (const n of nodes) {
            if (n.x === undefined) continue;
            const d = Math.hypot(n.x - gx, n.y! - gy);
            if (d < radius(n) + 6 / transform.k && d < bestD) {
              best = n;
              bestD = d;
            }
          }
          return best;
        }

        size();
        const sim = d3
          .forceSimulation<SimNode>(nodes)
          .force(
            'link',
            d3
              .forceLink<SimNode, SimLink>(links as never)
              .id((d) => d.id)
              .distance((l) => (l.kind === 'cross' ? 120 : 62))
              .strength((l) => (l.kind === 'cross' ? 0.08 : 0.55)),
          )
          .force('charge', d3.forceManyBody<SimNode>().strength((d) => (d.kind === 'hub' ? -520 : -95)))
          .force('collide', d3.forceCollide<SimNode>().radius((d) => radius(d) + 5))
          .force('x', d3.forceX<SimNode>(0).strength(0.035))
          .force('y', d3.forceY<SimNode>(0).strength(0.045))
          .on('tick', draw);

        function fit() {
          const xs = nodes.map((n) => n.x ?? 0);
          const ys = nodes.map((n) => n.y ?? 0);
          const minX = Math.min(...xs) - 40;
          const maxX = Math.max(...xs) + 40;
          const minY = Math.min(...ys) - 40;
          const maxY = Math.max(...ys) + 50;
          const k = Math.max(0.3, Math.min(2.2, Math.min(width / (maxX - minX), height / (maxY - minY))));
          const t = d3.zoomIdentity.translate(-((minX + maxX) / 2) * k, -((minY + maxY) / 2) * k).scale(k);
          d3.select(canvas!).transition().duration(350).call(zoom.transform, t);
        }

        const zoom = d3
          .zoom<HTMLCanvasElement, unknown>()
          .scaleExtent([0.3, 4])
          .on('zoom', (ev) => {
            transform = ev.transform;
            draw();
          });

        let downAt: [number, number] | null = null;
        const drag = d3
          .drag<HTMLCanvasElement, unknown, SimNode | undefined>()
          .container(canvas)
          .subject((ev) => find(ev.x, ev.y) ?? undefined)
          .on('start', (ev) => {
            const n = ev.subject as SimNode;
            downAt = [ev.x, ev.y];
            if (!ev.active) sim.alphaTarget(0.25).restart();
            n.fx = n.x;
            n.fy = n.y;
          })
          .on('drag', (ev) => {
            const n = ev.subject as SimNode;
            const [gx, gy] = toGraph(ev.x, ev.y);
            n.fx = gx;
            n.fy = gy;
          })
          .on('end', (ev) => {
            const n = ev.subject as SimNode;
            if (!ev.active) sim.alphaTarget(0);
            n.fx = null;
            n.fy = null;
            const moved = downAt ? Math.hypot(ev.x - downAt[0], ev.y - downAt[1]) : 99;
            if (moved < 4 && n.kind === 'hub') live.current.onSelect(n.bucket);
          });

        const sel = d3.select(canvas);
        sel.call(drag).call(zoom).on('dblclick.zoom', null);

        const onMove = (ev: PointerEvent) => {
          const rect = canvas.getBoundingClientRect();
          const n = find(ev.clientX - rect.left, ev.clientY - rect.top);
          if (n !== hovered) {
            hovered = n;
            canvas.style.cursor = n ? (n.kind === 'hub' ? 'pointer' : 'grab') : 'default';
            draw();
          }
          const tip = tipRef.current;
          if (tip) {
            if (n) {
              tip.textContent = n.kind === 'hub' ? `${n.bucket} ${n.label}` : n.label;
              tip.style.transform = `translate(${ev.clientX - rect.left + 12}px, ${ev.clientY - rect.top + 12}px)`;
              tip.classList.add('is-shown');
            } else tip.classList.remove('is-shown');
          }
        };
        const onLeave = () => {
          hovered = null;
          tipRef.current?.classList.remove('is-shown');
          draw();
        };
        canvas.addEventListener('pointermove', onMove);
        canvas.addEventListener('pointerleave', onLeave);

        const retheme = () => {
          theme = tokens();
          draw();
        };
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        mq.addEventListener('change', retheme);
        const themeObserver = new MutationObserver(retheme);
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        const ro = new ResizeObserver(() => {
          size();
          draw();
        });
        ro.observe(host);

        // Fit once the layout has mostly settled.
        const fitTimer = window.setTimeout(fit, 900);
        api.current = { fit, redraw: draw };

        cleanup = () => {
          window.clearTimeout(fitTimer);
          sim.stop();
          sel.on('.zoom', null).on('.drag', null);
          canvas.removeEventListener('pointermove', onMove);
          canvas.removeEventListener('pointerleave', onLeave);
          mq.removeEventListener('change', retheme);
          themeObserver.disconnect();
          ro.disconnect();
          api.current = null;
        };
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [graph]);

  return (
    <div className="web">
      <div className="web-bar">
        <button type="button" className="btn-tinted" onClick={() => api.current?.fit()}>
          Fit
        </button>
        <button type="button" className="btn-tinted" aria-pressed={labels} onClick={() => setLabels(!labels)}>
          Labels
        </button>
        <span className="web-stat">
          {graph.nodes.length} nodes, {graph.links.length} links
        </span>
      </div>
      <div className="web-stage" ref={hostRef}>
        <canvas
          ref={canvasRef}
          className="web-canvas"
          role="img"
          aria-label={`Life OS web: ${graph.nodes.length} nodes across six buckets. Click a bucket hub to filter.`}
        />
        <div className="web-tip" ref={tipRef} aria-hidden="true" />
        {failed ? <p className="empty web-failed">The web could not start in this browser.</p> : null}
      </div>
    </div>
  );
}
