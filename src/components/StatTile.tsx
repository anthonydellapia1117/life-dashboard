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
export function StatTile({ label, value, delta, series, href, alert }: StatTileProps) {
  const className = `stat-tile${alert ? ' is-alert' : ''}`;
  const body = (
    <>
      <span className="stat-tile-value">{value}</span>
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
