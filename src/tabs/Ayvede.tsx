import type { AyvedeData, NewsletterRow, StatusRow } from '../types';
import { Card, EmptyState, InfoBox, Pill } from '../components/ui';
import { DataTable, type Column } from '../components/DataTable';
import { Alerts } from '../components/Alerts';

const statusColumns: Column<StatusRow>[] = [
  {
    key: 'item',
    header: 'Item',
    render: (s) => (
      <>
        <div className="label">{s.item}</div>
        {s.detail ? <div className="sub">{s.detail}</div> : null}
      </>
    ),
  },
  { key: 'status', header: 'Status', render: (s) => <Pill tone={s.pill}>{s.status}</Pill> },
];

const newsletterColumns: Column<NewsletterRow>[] = [
  { key: 'item', header: 'Item', render: (n) => <span className="label">{n.item}</span> },
  { key: 'detail', header: 'Detail', render: (n) => <span className="sub">{n.detail}</span> },
];

export function Ayvede({ data }: { data: AyvedeData | undefined }) {
  return (
    <div className="tab-page">
      {data?.summary ? <p className="section-summary">{data.summary}</p> : null}

      {!data ? (
        <EmptyState label="No Ayvede data yet." />
      ) : (
        <>
          <Alerts alerts={data.alerts} />

          <div className="grid cols-2">
            <Card title="Business Status" badge="Current">
              <DataTable columns={statusColumns} rows={data.status} getRowId={(s) => s.id} />
              <InfoBox>{data.businessNote}</InfoBox>
            </Card>
            <Card title='Newsletter - "AI, Properly"' badge="Content">
              <DataTable columns={newsletterColumns} rows={data.newsletter} getRowId={(n) => n.id} />
              <InfoBox>{data.newsletterNote}</InfoBox>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
