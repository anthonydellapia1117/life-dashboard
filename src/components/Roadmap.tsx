import { useMemo } from 'react';
import { roadmapByMonth, roadmapLanes } from '../lib/roadmap';
import { gradeClass, gradeOf } from '../lib/grade';
import type { ResolvedNode } from '../lib/live';
import { formatDate } from '../lib/date';
import { GradeIcon } from './GradeIcon';

/**
 * The roadmap: what is coming, in order, with the empty months left in.
 *
 * Empty buckets stay visible on purpose. A roadmap that closes its gaps reads
 * as a solid run of work and hides the fact that November is free, which is
 * exactly the thing a roadmap is for.
 *
 * Two shapes for two screens: a single column of months on a phone, and a
 * lane per area at desktop width, where the extra room buys a comparison
 * across areas instead of just more whitespace.
 */

/** Axis key for the load chart: the month name, or a readable word for the two special buckets. */
function shortKey(label: string): string {
  if (label === 'No date') return 'None';
  if (label === 'Overdue') return 'Late';
  return label.split(' ')[0];
}

function Item({
  node,
  now,
  onOpen,
  onToggle,
}: {
  node: ResolvedNode;
  now: Date;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const grade = gradeOf({ due: node.due, horizon: node.horizon, done: node.done }, now);
  return (
    <div className={`road-item ${gradeClass(grade)}${node.done ? ' road-done' : ''}`}>
      <button
        type="button"
        className="road-check"
        role="checkbox"
        aria-checked={node.done}
        aria-label={node.done ? `Mark "${node.title}" not done` : `Mark "${node.title}" done`}
        onClick={() => onToggle(node.id)}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="m3.5 8.5 3 3 6-6.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button type="button" className="road-body" onClick={() => onOpen(node.id)}>
        <span className="road-title">{node.title}</span>
        <span className="road-when">{node.due ? formatDate(node.due) : 'No date'}</span>
      </button>
    </div>
  );
}

export function Roadmap({
  nodes,
  now,
  months = 6,
  onOpen,
  onToggle,
}: {
  nodes: ResolvedNode[];
  now: Date;
  months?: number;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const buckets = useMemo(() => roadmapByMonth(nodes, now, months), [nodes, now, months]);
  const lanes = useMemo(() => roadmapLanes(nodes, now, months), [nodes, now, months]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const busiest = Math.max(1, ...buckets.map((b) => b.items.length));

  return (
    <div className="road">
      <div className="road-load" aria-hidden="true">
        {buckets.map((bucket) => (
          <div key={bucket.key} className="road-load-col">
            <div className="road-load-bar" style={{ height: `${Math.round((bucket.items.length / busiest) * 100)}%` }} />
            <span className="road-load-key">{shortKey(bucket.label)}</span>
          </div>
        ))}
      </div>
      <p className="caption">How the next {months} months are loaded. Bars are item counts, tallest is {busiest}.</p>

      <div className="road-column">
        {buckets.map((bucket) => (
          <section key={bucket.key} className="road-bucket" aria-label={bucket.label}>
            <header className="road-head">
              <h3 className="road-month">{bucket.label}</h3>
              <span className="road-count">{bucket.items.length}</span>
            </header>
            {bucket.items.length === 0 ? (
              <p className="road-clear">Clear</p>
            ) : (
              bucket.items.map((item) => {
                const node = byId.get(item.nodeId);
                return node ? <Item key={item.nodeId} node={node} now={now} onOpen={onOpen} onToggle={onToggle} /> : null;
              })
            )}
          </section>
        ))}
      </div>

      <div className="road-lanes">
        <h3 className="section-heading">By area</h3>
        <div className="road-grid" style={{ gridTemplateColumns: `minmax(88px, 0.8fr) repeat(${buckets.length}, minmax(64px, 1fr))` }}>
          <div className="road-grid-corner" />
          {buckets.map((bucket) => (
            <div key={bucket.key} className="road-grid-head">
              {bucket.label}
            </div>
          ))}
          {lanes.map((lane) => (
            <LaneRow key={lane.area} lane={lane} now={now} byId={byId} onOpen={onOpen} />
          ))}
        </div>
      </div>
    </div>
  );
}

function LaneRow({
  lane,
  now,
  byId,
  onOpen,
}: {
  lane: { area: string; buckets: { key: string; label: string; items: { nodeId: string; title: string }[] }[] };
  now: Date;
  byId: Map<string, ResolvedNode>;
  onOpen: (id: string) => void;
}) {
  return (
    <>
      <div className="road-lane-name">{lane.area}</div>
      {lane.buckets.map((bucket) => (
        <div key={bucket.key} className="road-cell">
          {bucket.items.map((item) => {
            const node = byId.get(item.nodeId);
            if (!node) return null;
            const grade = gradeOf({ due: node.due, horizon: node.horizon, done: node.done }, now);
            return (
              <button
                key={item.nodeId}
                type="button"
                className={`road-pip ${gradeClass(grade)}`}
                title={`${node.title} - ${node.due ?? 'no date'}`}
                aria-label={`${node.title}, ${node.due ?? 'no date'}`}
                onClick={() => onOpen(item.nodeId)}
              >
                <GradeIcon grade={grade} size={11} />
              </button>
            );
          })}
        </div>
      ))}
    </>
  );
}
