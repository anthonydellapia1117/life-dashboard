import type { Kpi } from '../types';
import { EmptyState } from './ui';
import { StatTile } from './StatTile';

export function KpiStrip({ kpis }: { kpis: Kpi[] | undefined }) {
  if (!kpis || kpis.length === 0) return <EmptyState label="No KPIs yet." />;
  return (
    <div className="kpi-strip">
      {kpis.map((kpi) => (
        <StatTile key={kpi.id} label={kpi.label} value={kpi.value} />
      ))}
    </div>
  );
}
