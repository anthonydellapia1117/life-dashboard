import { kpiCounts, type EisenInput } from '../lib/eisenhower';
import { Sparkline } from './ui';

export interface StatTileProps {
  label: string;
  value: string | number;
  /** One short line under the label, e.g. "+3 vs last week". */
  delta?: string;
  /** Real per-day history only. Fewer than two points draws no sparkline - never a made-up one. */
  series?: number[];
  /** When set the whole tile is a link. */
  href?: string;
  /** Marks a figure that needs action now (red figure); the label still says what it is. */
  alert?: boolean;
}

/**
 * The one KPI tile. The number is the tile: value first in the DOM in the
 * display face, the label in small caps below, then an optional delta and a
 * sparkline in the world accent. Every tab's key numbers use this.
 */
/**
 * Values longer than four characters (a currency figure, a date) shrink to fit
 * their tile instead of clipping. Returns the character count the CSS divides
 * the tile width by, or null for a short figure that keeps the full size.
 */
export function valueFitChars(value: string | number): number | null {
  const n = String(value).length;
  return n > 4 ? n : null;
}

export function StatTile({ label, value, delta, series, href, alert }: StatTileProps) {
  const chars = valueFitChars(value);
  const className = `stat-tile${alert ? ' is-alert' : ''}${chars ? ' is-long' : ''}`;
  const body = (
    <>
      <span className="stat-tile-value" style={chars ? ({ '--chars': chars } as React.CSSProperties) : undefined}>
        {value}
      </span>
      <span className="stat-tile-label">{label}</span>
      {delta ? <span className="stat-tile-delta">{delta}</span> : null}
      {series && series.length >= 2 ? <Sparkline points={series} width={120} height={28} /> : null}
    </>
  );
  if (href) {
    return (
      <a className={className} href={href}>
        {body}
      </a>
    );
  }
  return <div className={className}>{body}</div>;
}

/** A row of StatTiles, the first thing under the header band on every tab. */
export function StatRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="stat-row" aria-label={label}>
      {children}
    </section>
  );
}

/**
 * The shared first row on every list tab: Overdue, Due this week, Open, most
 * important first. Same counts as the Life OS row (kpiCounts).
 */
export function KeyNumbers({ nodes, now }: { nodes: ReadonlyArray<EisenInput>; now: Date }) {
  const kpis = kpiCounts([...nodes], now);
  return (
    <StatRow label="Key numbers">
      <StatTile label="Overdue" value={kpis.overdue} alert={kpis.overdue > 0} />
      <StatTile label="Due this week" value={kpis.dueThisWeek} />
      <StatTile label="Open" value={kpis.open} />
    </StatRow>
  );
}
