import type { PillTone } from '../types';
import { StatusIcon, type StatusTone } from './StatusIcon';

/** Which reserved status colour (if any) a pill tone carries - see global.css. */
const PILL_STATUS: Record<PillTone, StatusTone | undefined> = {
  live: 'good',
  due: 'critical',
  soon: 'warning',
  done: undefined,
  watch: undefined,
};

export function Card({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">{title}</div>
        {badge ? <div className="card-badge">{badge}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  const status = PILL_STATUS[tone];
  return (
    <span className={`pill pill-${tone}`}>
      {status ? <StatusIcon tone={status} /> : null}
      {children}
    </span>
  );
}

export function InfoBox({ children }: { children: React.ReactNode }) {
  return <div className="info-box">{children}</div>;
}

export function EmptyState({ label = 'Nothing here yet.' }: { label?: string }) {
  return <div className="empty-state">{label}</div>;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="section-label">{children}</div>;
}

/** Small inline SVG progress bar - no chart library needed. */
export function ProgressBar({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const width = 200;
  const height = 8;
  return (
    <div className="progress-bar" role="img" aria-label={label ?? `${Math.round(pct * 100)}%`}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <rect x="0" y="0" width={width} height={height} rx={height / 2} className="progress-track" />
        <rect x="0" y="0" width={width * pct} height={height} rx={height / 2} className="progress-fill" />
      </svg>
    </div>
  );
}

/** Small inline SVG sparkline for a short numeric series. */
export function Sparkline({ points, width = 160, height = 32 }: { points: number[]; width?: number; height?: number }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const d = points
    .map((p, i) => {
      const x = i * step;
      const y = height - ((p - min) / range) * height;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="sparkline" aria-hidden="true">
      <path d={d} fill="none" strokeWidth={2} />
    </svg>
  );
}
