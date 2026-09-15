import type { Kpi } from '../types';
import { EmptyState } from './ui';

export function KpiStrip({ kpis }: { kpis: Kpi[] | undefined }) {
  if (!kpis || kpis.length === 0) return <EmptyState label="No KPIs yet." />;
  return (
    <div className="kpi-strip">
      {kpis.map((kpi) => (
        <div className="kpi" key={kpi.id}>
          <div className="kpi-number">{kpi.value}</div>
          <div className="kpi-label">{kpi.label}</div>
        </div>
      ))}
    </div>
  );
}
