import { GRADE_META, GRADE_ORDER, gradeClass, gradeOf, type Grade } from '../lib/grade';
import type { ResolvedNode } from '../lib/live';
import type { Counts } from '../lib/progress';
import { GradeIcon } from './GradeIcon';

/**
 * Counters and the grade distribution.
 *
 * Every figure here is a count of real items, never a percentage standing in
 * for one: "7 of 19 done" first, the percent second and smaller, because the
 * percent is the part you cannot act on.
 */

/**
 * The done/left bar. One fill, one ground, the numbers beside it in ordinary ink.
 * `bare` drops the numbers for a place that has just said them in a sentence -
 * printing "1 of 9 done" directly under "1 of 9 finished" is the same fact twice.
 */
export function ProgressBar({ counts, label, bare = false }: { counts: Counts; label?: string; bare?: boolean }) {
  return (
    <div className={`progress${bare ? ' progress-bare' : ''}`}>
      {bare ? null : (
        <div className="progress-head">
          {label ? <span className="progress-label">{label}</span> : null}
          <span className="progress-count">
            <strong>{counts.done}</strong> of {counts.total} done
          </span>
          {counts.left > 0 ? <span className="progress-left">{counts.left} left</span> : null}
        </div>
      )}
      <div
        className="progress-track"
        role="img"
        aria-label={`${counts.done} of ${counts.total} done, ${counts.left} left`}
      >
        <div className="progress-fill" style={{ width: `${counts.pct}%` }} />
      </div>
    </div>
  );
}

/** A ring for the one place a view wants a single figure to carry the screen. */
export function ProgressRing({ counts, size = 96 }: { counts: Counts; size?: number }) {
  const stroke = Math.max(6, Math.round(size / 12));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (counts.pct / 100) * circumference;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" />
        <circle
          className="ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-value">
        <span className="ring-pct">{counts.pct}</span>
        <span className="ring-unit">%</span>
      </div>
    </div>
  );
}

export interface GradeSlice {
  grade: Grade;
  count: number;
}

/** Count items into grade buckets, most urgent first, empty buckets dropped. */
export function gradeSlices(nodes: ResolvedNode[], now: Date): GradeSlice[] {
  const counts = new Map<Grade, number>();
  for (const node of nodes) {
    const grade = gradeOf({ due: node.due, horizon: node.horizon, done: node.done }, now);
    counts.set(grade, (counts.get(grade) ?? 0) + 1);
  }
  return GRADE_ORDER.map((grade) => ({ grade, count: counts.get(grade) ?? 0 })).filter((s) => s.count > 0);
}

/**
 * The stacked grade bar: where everything sits, in one line. Segments carry a
 * 2px gap so two adjacent grades never melt into one band, and the legend
 * under it names every colour - the bar is never the only way to read this.
 */
export function GradeDistribution({ nodes, now, title }: { nodes: ResolvedNode[]; now: Date; title?: string }) {
  const slices = gradeSlices(nodes, now);
  const total = slices.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return null;

  return (
    <div className="dist">
      {title ? <div className="dist-title">{title}</div> : null}
      <div
        className="dist-bar"
        role="img"
        aria-label={slices.map((s) => `${s.count} ${GRADE_META[s.grade].label}`).join(', ')}
      >
        {slices.map((s) => (
          <div
            key={s.grade}
            className={`dist-seg ${gradeClass(s.grade)}`}
            style={{ flexGrow: s.count }}
            title={`${GRADE_META[s.grade].label}: ${s.count}`}
          />
        ))}
      </div>
      <ul className="dist-legend">
        {slices.map((s) => (
          <li key={s.grade} className={`dist-key ${gradeClass(s.grade)}`}>
            <GradeIcon grade={s.grade} size={13} />
            <span className="dist-key-label">{GRADE_META[s.grade].label}</span>
            <span className="dist-key-count">{s.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
