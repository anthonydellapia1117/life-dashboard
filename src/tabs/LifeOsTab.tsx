import { StatTile } from '../components/StatTile';
import { useMemo, useState } from 'react';
import type { LifeData } from '../types';
import type { ResolvedNode } from '../lib/live';
import { BUCKETS, bucketOf, countByBucket, type BucketId } from '../lib/bucket';
import { kpiCounts } from '../lib/eisenhower';
import { loadCalendarFile } from '../lib/calendarFile';
import { formatWeekdayMonthDayISO } from '../lib/date';
import { useBucketFilter } from '../lib/filter';
import {
  FALLBACK_TIEBREAK,
  FALLBACK_TILES,
  FILES_FILED,
  FILES_FILED_AS_OF,
  buildWeb,
  sectionCounts,
} from '../lib/lifeosGraph';
import { SegmentedControl } from '../components/SegmentedControl';
import { Buckets3D } from '../components/Buckets3D';
import { LifeWeb } from '../components/LifeWeb';

type Metric = 'open' | 'week' | 'files';

const METRICS: Array<{ id: Metric; label: string; unit: string }> = [
  { id: 'open', label: 'Open items', unit: 'open' },
  { id: 'week', label: 'Due this week', unit: 'due' },
  { id: 'files', label: 'Files filed', unit: 'files' },
];

interface Upcoming {
  key: string;
  date: string;
  time?: string;
  title: string;
  bucket: BucketId;
}

function isoToday(now: Date): string {
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

/** Next calendar items, today onward: the sealed calendar plus the optional local file. */
export function nextCalendar(data: LifeData, now: Date, limit = 3): Upcoming[] {
  const today = isoToday(now);
  const out: Upcoming[] = [];
  for (const e of data.calendar ?? []) {
    if (!e?.date || e.date.slice(0, 10) < today || e.state === 'done') continue;
    out.push({ key: `c:${e.id}`, date: e.date.slice(0, 10), time: e.time, title: e.title, bucket: bucketOf({ title: e.title, area: e.area, detail: e.detail }) });
  }
  loadCalendarFile().forEach((raw, i) => {
    const e = raw as { date?: unknown; title?: unknown; bucket?: unknown };
    if (typeof e?.date !== 'string' || typeof e.title !== 'string' || e.date.slice(0, 10) < today) return;
    out.push({ key: `f:${i}`, date: e.date.slice(0, 10), title: e.title, bucket: bucketOf({ bucket: e.bucket as number, title: e.title }) });
  });
  return out.sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? ''))).slice(0, limit);
}

/**
 * Life OS - the landing tab. Today at a glance, the six 3D buckets, the web,
 * then the bucket tiles and the folder map. Everything carries data-bucket so
 * the global filter (src/lib/filter.ts) dims what sits outside the chosen one.
 */
export function LifeOsTab({ data, nodes, now }: { data: LifeData; nodes: ResolvedNode[]; now: Date }) {
  const { selected, toggle } = useBucketFilter();
  const [metric, setMetric] = useState<Metric>('open');
  const [webgl, setWebgl] = useState(true);
  const lifeos = data.lifeos;

  const actionable = useMemo(
    () => nodes.filter((n) => n.kind === 'action' || n.kind === 'milestone' || n.kind === 'payment'),
    [nodes],
  );
  const open = useMemo(() => actionable.filter((n) => !n.done), [actionable]);
  const kpis = useMemo(() => kpiCounts(open, now), [open, now]);
  const upcoming = useMemo(() => nextCalendar(data, now), [data, now]);

  const values = useMemo(() => {
    const out: Record<Metric, Record<BucketId, number>> = {
      open: countByBucket(open),
      week: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
      files: { ...FILES_FILED },
    };
    for (const b of BUCKETS) {
      out.week[b.id] = kpiCounts(open.filter((n) => bucketOf(n) === b.id), now).dueThisWeek;
      const f = Number(lifeos?.filesFiled?.[String(b.id)]);
      if (Number.isFinite(f)) out.files[b.id] = f;
    }
    return out;
  }, [open, now, lifeos]);

  const graph = useMemo(() => buildWeb(lifeos, sectionCounts(open)), [lifeos, open]);
  const current = METRICS.find((m) => m.id === metric) ?? METRICS[0];

  return (
    <div className="tab-page lifeos-page">
      <section className="glance" aria-label="Today at a glance">
        <StatTile label="Overdue" value={kpis.overdue} alert={kpis.overdue > 0} href="#today" />
        <StatTile label="Due this week" value={kpis.dueThisWeek} href="#today" />
        <StatTile label="Open" value={kpis.open} href="#today" />
        <div className="glance-cal group">
          {upcoming.length === 0 ? <p className="empty">No calendar items ahead.</p> : null}
          {upcoming.map((u) => (
            <a key={u.key} className={`glance-event bucket-${u.bucket}`} data-bucket={u.bucket} href="#today">
              <span className="glance-event-dot" aria-hidden="true" />
              <span className="glance-event-title">{u.title}</span>
              <span className="glance-event-when">
                {formatWeekdayMonthDayISO(u.date)}
                {u.time ? `, ${u.time}` : ''}
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="hero3d" aria-label="Buckets">
        <div className="hero3d-head">
          <h2 className="title2">Six buckets</h2>
          <SegmentedControl
            className="seg-inline"
            ariaLabel="Bucket value"
            options={METRICS.map((m) => ({ id: m.id, label: m.label }))}
            active={metric}
            onChange={setMetric}
          />
        </div>
        {webgl ? (
          <Buckets3D
            values={values[metric]}
            unit={current.unit}
            selected={selected}
            onSelect={toggle}
            onUnavailable={() => setWebgl(false)}
          />
        ) : (
          <p className="footnote">3D view is off in this browser. The tiles below carry the same numbers.</p>
        )}
        {metric === 'files' ? (
          <p className="footnote">From the {lifeos?.filesFiledAsOf ?? FILES_FILED_AS_OF} Mac file sort.</p>
        ) : null}
      </section>

      <section aria-label="The web">
        <h2 className="title2">The web</h2>
        <LifeWeb graph={graph} selected={selected} onSelect={toggle} />
      </section>

      <section aria-label="Bucket tiles">
        <h2 className="title2">What goes where</h2>
        <div className="tiles">
          {BUCKETS.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`tile ${b.className} keep-clickable`}
              data-bucket={b.id}
              aria-pressed={selected === b.id}
              onClick={() => toggle(b.id)}
            >
              <span className="tile-head">
                <span className="tile-num">{b.id}</span>
                <span className="tile-name">{b.name}</span>
                <span className="tile-value">
                  {values[metric][b.id]} <span className="tile-unit">{current.unit}</span>
                </span>
              </span>
              <span className="tile-copy">{lifeos?.tiles?.[String(b.id)] ?? FALLBACK_TILES[b.id]}</span>
              {lifeos?.tileFolders?.[String(b.id)] ? (
                <span className="tile-folder">{lifeos.tileFolders[String(b.id)]}</span>
              ) : null}
            </button>
          ))}
        </div>
        <p className="callout tiebreak">{lifeos?.tiebreak ?? FALLBACK_TIEBREAK}</p>

        {lifeos?.folders && lifeos.folders.length > 0 ? (
          <div className="group table-group">
            <table className="folder-map">
              <thead>
                <tr>
                  <th>Folder</th>
                  <th>Bucket</th>
                </tr>
              </thead>
              <tbody>
                {lifeos.folders.map((f) => {
                  const id = typeof f.bucket === 'number' && f.bucket >= 1 && f.bucket <= 6 ? (f.bucket as BucketId) : undefined;
                  return (
                    <tr key={f.folder} data-bucket={id}>
                      <td>{f.folder}</td>
                      <td>
                        {id ? (
                          <span className={`bucket-tag bucket-${id}`}>
                            <span className="bucket-tag-dot" aria-hidden="true" />
                            {id} {BUCKETS[id - 1].name}
                          </span>
                        ) : (
                          <span className="footnote">{String(f.bucket)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
