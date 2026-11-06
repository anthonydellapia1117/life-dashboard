import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { select, zoom as d3zoom, zoomIdentity, type ZoomBehavior } from 'd3';
import { BUCKETS, type BucketId } from '../lib/bucket';
import type { WebGraph } from '../lib/lifeosGraph';
import { fitTransform, zoomAbout, type ZoomTransform } from '../lib/fit';
import { hubText, layoutWeb, LABEL_SIZE } from '../lib/webLayout';
import { ViewControls } from './ViewControls';

/**
 * The web, drawn as SVG from the pure layout in src/lib/webLayout.ts. Buckets
 * sit in soft hulls, hubs are pills, links curve. Hover lifts a node and its
 * neighbours and fades the rest; a click on a hub (or a legend chip) sets the
 * global filter. Wheel, pinch and drag pan and zoom (d3-zoom, 0.4 to 3; it
 * loads with this lazy tab, so no other tab pays for it); Fit puts the whole
 * web back in view.
 */
const ZOOM_MAX = 3;
const ZOOM_MIN = 0.4;
const PAD = 16;
// Fit never blows a small web up past this; the buttons and pinch still reach ZOOM_MAX.
const FIT_MAX = 1.4;

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
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
  const stageRef = useRef<HTMLDivElement>(null);
  // The stage shape, in steps of 0.25, so the layout only reruns when it really changes.
  const [aspect, setAspect] = useState(2);
  const layout = useMemo(() => layoutWeb(graph, { aspect }), [graph, aspect]);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const tRef = useRef<ZoomTransform>({ k: 1, x: 0, y: 0 });
  const [labels, setLabels] = useState(true);
  const [hover, setHover] = useState<string | null>(null);
  const [zoomPct, setZoomPct] = useState(100);

  const limits = useCallback(() => {
    const el = stageRef.current;
    const vp = { width: el?.clientWidth || 600, height: el?.clientHeight || 480 };
    const fitted = fitTransform(layout.bounds, vp, PAD, { min: 0.05, max: FIT_MAX });
    // The floor drops below 0.4 only when that is what it takes to show it all.
    return { vp, fitted, lim: { min: Math.min(ZOOM_MIN, fitted.k), max: ZOOM_MAX } };
  }, [layout]);

  const apply = useCallback((t: ZoomTransform, animate: boolean) => {
    const z = zoomRef.current;
    const svg = svgRef.current;
    if (z && svg) {
      const target = zoomIdentity.translate(t.x, t.y).scale(t.k);
      const sel = select(svg);
      if (animate && !reducedMotion()) sel.transition().duration(300).call(z.transform, target);
      else sel.call(z.transform, target);
    } else {
      tRef.current = t;
      gRef.current?.setAttribute('transform', `translate(${t.x},${t.y}) scale(${t.k})`);
      setZoomPct(Math.round(t.k * 100));
    }
  }, []);

  const fit = useCallback((animate = true) => apply(limits().fitted, animate), [apply, limits]);

  const zoomBy = useCallback(
    (factor: number) => {
      const { vp, lim } = limits();
      apply(zoomAbout(tRef.current, factor, { x: vp.width / 2, y: vp.height / 2 }, lim), true);
    },
    [apply, limits],
  );

  // Wire d3-zoom, starting from the fitted view.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([limits().lim.min, ZOOM_MAX])
      .on('zoom', (ev) => {
        const { k, x, y } = ev.transform;
        tRef.current = { k, x, y };
        gRef.current?.setAttribute('transform', `translate(${x},${y}) scale(${k})`);
        setZoomPct(Math.round(k * 100));
      });
    zoomRef.current = z;
    select(svg).call(z).on('dblclick.zoom', null);
    fit(false);
    return () => {
      select(svg).on('.zoom', null);
      zoomRef.current = null;
    };
  }, [fit, limits]);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const a = el.clientWidth / Math.max(1, el.clientHeight);
      if (Number.isFinite(a) && a > 0) setAspect(Math.round(a * 4) / 4);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Refit when the stage changes size (rotation, window resize).
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let last = `${el.clientWidth}x${el.clientHeight}`;
    const ro = new ResizeObserver(() => {
      const now = `${el.clientWidth}x${el.clientHeight}`;
      if (now === last) return;
      last = now;
      zoomRef.current?.scaleExtent([limits().lim.min, ZOOM_MAX]);
      fit(false);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit, limits]);

  const lit = useMemo(() => {
    if (!hover) return null;
    return new Set([hover, ...(layout.neighbours[hover] ?? [])]);
  }, [hover, layout]);

  const state = (id: string, bucket: BucketId) => {
    const out = selected !== null && bucket !== selected ? ' is-out' : '';
    if (!lit) return out;
    return out + (lit.has(id) ? ' is-lit' : ' is-faded');
  };

  const linkState = (s: string, t: string, sb: BucketId, tb: BucketId) => {
    const out = selected !== null && (sb !== selected || tb !== selected) ? ' is-out' : '';
    if (!hover) return out;
    return out + (s === hover || t === hover ? ' is-lit' : ' is-faded');
  };

  const bucketOfId = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n.bucket])), [layout]);

  return (
    <div className="web">
      <div className="web-bar">
        <ViewControls onZoomOut={() => zoomBy(1 / 1.3)} onFit={() => fit(true)} onZoomIn={() => zoomBy(1.3)} zoomLabel={`${zoomPct}%`}>
          <button type="button" className="btn-tinted" aria-pressed={labels} onClick={() => setLabels(!labels)}>
            Labels
          </button>
        </ViewControls>
        <span className="web-stat">
          {graph.nodes.length} nodes, {graph.links.length} links
        </span>
      </div>
      <div className="web-stage" ref={stageRef}>
        <svg
          ref={svgRef}
          className={`web-svg${hover ? ' has-hover' : ''}${labels ? '' : ' no-labels'}`}
          role="img"
          aria-label={`Life OS web: ${graph.nodes.length} nodes across six buckets. Click a bucket hub to filter.`}
          onPointerLeave={() => setHover(null)}
        >
          <g ref={gRef}>
            <g className="web-hulls">
              {layout.hulls.map((h) => (
                <path key={h.bucket} className={`web-hull bucket-${h.bucket}${selected !== null && h.bucket !== selected ? ' is-out' : ''}`} d={h.d} />
              ))}
            </g>
            <g className="web-links">
              {layout.links.map((l) => {
                const sb = bucketOfId.get(l.source)!;
                const tb = bucketOfId.get(l.target)!;
                return (
                  <path
                    key={`${l.source}|${l.target}`}
                    className={`web-link is-${l.kind} bucket-${sb}${linkState(l.source, l.target, sb, tb)}`}
                    d={l.d}
                  />
                );
              })}
            </g>
            <g className="web-nodes">
              {layout.nodes
                .filter((n) => n.kind !== 'hub')
                .map((n) => {
                  const label = layout.labels[n.id];
                  return (
                    <g
                      key={n.id}
                      className={`web-node is-${n.kind} bucket-${n.bucket}${state(n.id, n.bucket)}`}
                      onPointerEnter={() => setHover(n.id)}
                      onPointerLeave={() => setHover((h) => (h === n.id ? null : h))}
                    >
                      <circle cx={n.x} cy={n.y} r={n.r + 8} className="web-hit" />
                      <circle cx={n.x} cy={n.y} r={n.r} className="web-dot" />
                      {label ? (
                        <text
                          className={`web-label${label.visible ? '' : ' is-spare'}`}
                          x={label.x + label.w / 2}
                          y={label.y + label.h / 2}
                          fontSize={LABEL_SIZE}
                        >
                          {label.text}
                        </text>
                      ) : null}
                      <title>{n.label}</title>
                    </g>
                  );
                })}
            </g>
            <g className="web-hubs">
              {layout.nodes
                .filter((n) => n.kind === 'hub')
                .map((n) => (
                  <g
                    key={n.id}
                    className={`web-hub bucket-${n.bucket}${state(n.id, n.bucket)}${selected === n.bucket ? ' is-selected' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={selected === n.bucket}
                    aria-label={`Filter to bucket ${n.bucket}, ${n.label}`}
                    onPointerEnter={() => setHover(n.id)}
                    onPointerLeave={() => setHover((h) => (h === n.id ? null : h))}
                    onClick={() => onSelect(n.bucket)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(n.bucket);
                      }
                    }}
                  >
                    <rect x={n.x - n.w! / 2} y={n.y - n.h! / 2} width={n.w} height={n.h} rx={n.h! / 2} />
                    <text x={n.x} y={n.y}>
                      {hubText(n)}
                    </text>
                  </g>
                ))}
            </g>
          </g>
        </svg>
      </div>
      <div className="web-legend" role="group" aria-label="Buckets">
        {BUCKETS.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`web-chip ${b.className} keep-clickable`}
            data-bucket={b.id}
            aria-pressed={selected === b.id}
            onClick={() => onSelect(b.id)}
          >
            <span className="web-chip-dot" aria-hidden="true" />
            <span className="web-chip-num">{b.id}</span>
            {b.name}
          </button>
        ))}
      </div>
    </div>
  );
}
