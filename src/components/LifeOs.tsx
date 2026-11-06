import { useMemo, useState } from 'react';
import { BUCKETS, bucketMeta, bucketOf, countByBucket, type BucketId } from '../lib/bucket';
import { compareByGrade, gradeOf } from '../lib/grade';
import { QUADRANTS, kpiCounts, quadrantOf, weekStrip, type Quadrant } from '../lib/eisenhower';
import { loadCalendarFile } from '../lib/calendarFile';
import type { ResolvedNode } from '../lib/live';
import { GradeChip } from './GradeIcon';

/** Items shown per quadrant in TLDR mode. */
const TLDR_LIMIT = 5;

function Chip({ node, now, onOpen }: { node: ResolvedNode; now: Date; onOpen: (id: string) => void }) {
  const bucket = bucketMeta(bucketOf(node));
  const grade = gradeOf({ due: node.due, horizon: node.horizon, done: node.done }, now);
  return (
    <button
      type="button"
      className={`eis-chip ${bucket.className}`}
      onClick={() => onOpen(node.id)}
      title={`${bucket.name}: ${node.title}`}
    >
      <span className="eis-chip-title">{node.title}</span>
      <span className="eis-chip-meta">
        <GradeChip grade={grade} short />
        <span className="eis-chip-bucket">{bucket.name}</span>
      </span>
    </button>
  );
}

/**
 * Life OS home: KPI strip, bucket filter, Eisenhower 2x2, 7-day strip.
 * Reads the same resolved items as every other screen, so numbers match.
 */
export function LifeOs({
  nodes,
  now,
  onOpen,
  showAll,
}: {
  nodes: ResolvedNode[];
  now: Date;
  onOpen: (id: string) => void;
  showAll: boolean;
}) {
  const [filter, setFilter] = useState<BucketId | undefined>(undefined);
  const [expanded, setExpanded] = useState<Partial<Record<Quadrant, boolean>>>({});

  const open = useMemo(() => nodes.filter((n) => !n.done), [nodes]);
  const counts = useMemo(() => countByBucket(open), [open]);
  const kpis = useMemo(() => kpiCounts(open, now), [open, now]);
  const visible = useMemo(() => (filter ? open.filter((n) => bucketOf(n) === filter) : open), [open, filter]);

  const byQuadrant = useMemo(() => {
    const map: Record<Quadrant, ResolvedNode[]> = { do: [], schedule: [], delegate: [], drop: [] };
    for (const n of [...visible].sort((a, b) => compareByGrade(a, b, now))) map[quadrantOf(n, now)].push(n);
    return map;
  }, [visible, now]);

  const strip = useMemo(() => weekStrip(loadCalendarFile(), now), [now]);

  return (
    <div className="lifeos">
      <section className="eis-kpis" aria-label="Key numbers">
        <div className="eis-kpi">
          <span className="eis-kpi-label">Open</span>
          <span className="eis-kpi-value">{kpis.open}</span>
        </div>
        <div className="eis-kpi">
          <span className="eis-kpi-label">Due this week</span>
          <span className="eis-kpi-value">{kpis.dueThisWeek}</span>
        </div>
        <div className="eis-kpi">
          <span className="eis-kpi-label">Overdue</span>
          <span className="eis-kpi-value">{kpis.overdue}</span>
        </div>
      </section>

      <div className="eis-pills" role="group" aria-label="Filter by bucket">
        {BUCKETS.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`eis-pill ${b.className}${filter === b.id ? ' is-on' : ''}`}
            aria-pressed={filter === b.id}
            onClick={() => setFilter(filter === b.id ? undefined : b.id)}
          >
            <span className="eis-pill-dot" aria-hidden="true" />
            {b.name}
            <span className="eis-pill-count">{counts[b.id]}</span>
          </button>
        ))}
      </div>

      <div className="eis-grid">
        {QUADRANTS.map((q) => {
          const items = byQuadrant[q.id];
          const all = showAll || expanded[q.id];
          const shown = all ? items : items.slice(0, TLDR_LIMIT);
          const more = items.length - shown.length;
          return (
            <section key={q.id} className="eis-quad" aria-label={q.title}>
              <h2 className="eis-quad-title">
                {q.title} <span className="eis-quad-count">{items.length}</span>
              </h2>
              <p className="eis-quad-caption">{q.caption}</p>
              <div className="eis-quad-list">
                {shown.length === 0 ? <p className="empty">Nothing here.</p> : null}
                {shown.map((n) => (
                  <Chip key={n.id} node={n} now={now} onOpen={onOpen} />
                ))}
              </div>
              {more > 0 ? (
                <button type="button" className="eis-more" onClick={() => setExpanded({ ...expanded, [q.id]: true })}>
                  +{more} more
                </button>
              ) : null}
            </section>
          );
        })}
      </div>

      <section aria-label="Next 7 days">
        <h2 className="section-heading">Next 7 days</h2>
        <div className="eis-strip">
          {strip.map((d) => (
            <div key={d.date} className={`eis-day${d.isToday ? ' is-today' : ''}`}>
              <div className="eis-day-head">
                <span>{d.weekday}</span>
                <span className="eis-day-num">{d.dayOfMonth}</span>
              </div>
              {d.entries.map((e, i) => (
                <div
                  key={`${e.title}-${i}`}
                  className={`eis-event ${bucketMeta(bucketOf({ bucket: e.bucket })).className}`}
                  title={e.title}
                >
                  {e.title}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
