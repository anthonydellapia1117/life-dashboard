import type { LifeData } from '../types';
import { Alerts } from '../components/Alerts';
import { KpiStrip } from '../components/KpiStrip';
import { ActionList } from '../components/ActionList';
import { Timeline } from '../components/Timeline';
import { Card } from '../components/ui';

export function Overview({ data }: { data: LifeData }) {
  return (
    <div className="tab-page">
      <div className="page-header">
        <h1>
          Life <span className="accent">Dashboard</span>
        </h1>
        <div className="page-sub">
          Full state across all initiatives - pulled from Calendar, Gmail, screen context, and VFS notes.
        </div>
      </div>

      <Alerts alerts={data.alerts} />
      <KpiStrip kpis={data.kpis} />

      <div className="grid cols-2">
        <Card title="Priority Actions" badge="30 days">
          <ActionList actions={data.actions} />
        </Card>
        <Card title="Calendar - Next 30 Days" badge="Sep-Oct">
          <Timeline events={data.calendar} />
        </Card>
      </div>
    </div>
  );
}
