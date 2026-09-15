import { formatWeekdayMonthDayISO } from '../lib/date';
import type { WorkData } from '../types';
import { Card, EmptyState, InfoBox, Pill, SectionLabel } from '../components/ui';
import { DataTable, type Column } from '../components/DataTable';
import { ActionList } from '../components/ActionList';
import type { Milestone, CompletedEngagement } from '../types';

const milestoneColumns: Column<Milestone>[] = [
  {
    key: 'name',
    header: 'Milestone',
    render: (m) => (
      <>
        <div className="label">{m.name}</div>
        {m.detail ? <div className="sub">{m.detail}</div> : null}
      </>
    ),
  },
  { key: 'due', header: 'Due', render: (m) => <span className="mono">{formatWeekdayMonthDayISO(m.due)}</span> },
  { key: 'status', header: 'Status', render: (m) => <Pill tone={m.pill}>{m.status}</Pill> },
];

const completedColumns: Column<CompletedEngagement>[] = [
  {
    key: 'project',
    header: 'Project',
    render: (c) => (
      <>
        <div className="label">{c.project}</div>
        {c.detail ? <div className="sub">{c.detail}</div> : null}
      </>
    ),
  },
  { key: 'role', header: 'Role', render: (c) => <span className="sub">{c.role}</span> },
  { key: 'status', header: 'Status', render: (c) => <Pill tone={c.pill}>{c.status}</Pill> },
];

export function Work({ data }: { data: WorkData | undefined }) {
  return (
    <div className="tab-page">
      {data?.summary ? <p className="section-summary">{data.summary}</p> : null}

      {!data ? (
        <EmptyState label="No work data yet." />
      ) : (
        <>
          <div className="grid cols-2">
            <Card title={data.engagement.name} badge={data.engagement.status}>
              <DataTable columns={milestoneColumns} rows={data.engagement.milestones} getRowId={(m) => m.id} />
              <InfoBox>
                <strong>Role:</strong> {data.engagement.role}
                <br />
                <strong>Partner:</strong> {data.engagement.partner}
                <br />
                <strong>Team:</strong> {data.engagement.team.join(', ')}
                <br />
                <strong>Client Sponsor:</strong> {data.engagement.clientSponsor}
                <br />
                <strong>Scope:</strong> {data.engagement.scope}
              </InfoBox>
            </Card>
            <Card title="Action items">
              <ActionList actions={data.actionItems} />
            </Card>
          </div>

          <SectionLabel>Completed Engagements</SectionLabel>
          <div className="card">
            <DataTable columns={completedColumns} rows={data.completed} getRowId={(c) => c.id} />
          </div>
        </>
      )}
    </div>
  );
}
