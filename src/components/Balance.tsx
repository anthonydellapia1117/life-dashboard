import type { AreaCount, BalanceTotals } from '../lib/balance';
import { StatTile } from './StatTile';
import { EmptyState } from './ui';

/** Balance: Work/Life/Build totals, then one bar per area in a single hue. */
export function Balance({ totals, areas }: { totals: BalanceTotals; areas: AreaCount[] }) {
  const max = areas.length > 0 ? areas[0].count : 0;
  return (
    <div className="balance">
      <div className="balance-stats">
        <StatTile label="Work" value={String(totals.work)} />
        <StatTile label="Life" value={String(totals.life)} />
        <StatTile label="Build" value={String(totals.build)} />
      </div>
      {areas.length === 0 ? (
        <EmptyState label="No open actions." />
      ) : (
        <div className="balance-bars">
          {areas.map((row) => (
            <div className="balance-row" key={row.area}>
              <div className="balance-row-label">{row.area}</div>
              <div className="balance-row-track">
                <div className="balance-row-fill" style={{ width: `${max > 0 ? (row.count / max) * 100 : 0}%` }} />
              </div>
              <div className="balance-row-count">{row.count}</div>
            </div>
          ))}
        </div>
      )}
      <div className="caption">Where the next two weeks go.</div>
    </div>
  );
}
