import type { AiStackData, RemovedToolRow, StackComponentRow, ToolRow } from '../types';
import { Card, EmptyState, InfoBox, Pill, SectionLabel } from '../components/ui';
import { DataTable, type Column } from '../components/DataTable';

const activeColumns: Column<ToolRow>[] = [
  {
    key: 'tool',
    header: 'Tool',
    render: (t) => (
      <>
        <div className="label">{t.tool}</div>
        {t.detail ? <div className="sub">{t.detail}</div> : null}
      </>
    ),
  },
  { key: 'role', header: 'Role', render: (t) => <span className="sub">{t.role ?? ''}</span> },
  { key: 'status', header: 'Status', render: (t) => <Pill tone={t.pill}>{t.status}</Pill> },
];

const removedColumns: Column<RemovedToolRow>[] = [
  { key: 'tool', header: 'Tool', render: (t) => <span className="label">{t.tool}</span> },
  { key: 'removed', header: 'Removed', render: (t) => <span className="mono">{t.removed}</span> },
  { key: 'reason', header: 'Reason', render: (t) => <span className="sub">{t.reason}</span> },
];

const stackColumns: Column<StackComponentRow>[] = [
  { key: 'component', header: 'Component', render: (s) => <span className="label">{s.component}</span> },
  { key: 'tool', header: 'Tool', render: (s) => <span className="sub">{s.tool}</span> },
];

export function AiStack({ data }: { data: AiStackData | undefined }) {
  return (
    <div className="tab-page">
      <div className="page-header">
        <h1>
          AI <span className="accent">Tool Stack</span>
        </h1>
        {data?.summary ? <div className="page-sub">{data.summary}</div> : null}
      </div>

      {!data ? (
        <EmptyState label="No AI stack data yet." />
      ) : (
        <>
          <div className="grid cols-2">
            <Card title="Active Tools" badge="Current">
              <DataTable columns={activeColumns} rows={data.active} getRowId={(t) => t.id} />
            </Card>
            <Card title="Removed / Cancelled" badge="Cleaned up">
              <DataTable columns={removedColumns} rows={data.removed} getRowId={(t) => t.id} />
            </Card>
          </div>

          <SectionLabel>Build Stack Pattern</SectionLabel>
          <div className="card">
            <DataTable columns={stackColumns} rows={data.stack} getRowId={(s) => s.id} />
            <InfoBox>{data.note}</InfoBox>
          </div>
        </>
      )}
    </div>
  );
}
