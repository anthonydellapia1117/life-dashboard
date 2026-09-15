import type { FinancesData, OpenItemRow, PaymentRow, SubscriptionRow } from '../types';
import { Card, EmptyState, InfoBox, Pill, SectionLabel } from '../components/ui';
import { DataTable, type Column } from '../components/DataTable';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const paymentColumns: Column<PaymentRow>[] = [
  {
    key: 'item',
    header: 'Item',
    render: (p) => (
      <>
        <div className="label">{p.item}</div>
        {p.detail ? <div className="sub">{p.detail}</div> : null}
      </>
    ),
  },
  { key: 'amount', header: 'Amount', render: (p) => <span className="amount">{p.amount !== undefined ? currency.format(p.amount) : 'TBD'}</span> },
  { key: 'due', header: 'Due', render: (p) => <span className="mono">{p.due}</span> },
];

const subscriptionColumns: Column<SubscriptionRow>[] = [
  { key: 'tool', header: 'Tool', render: (s) => <span className="label">{s.tool}</span> },
  { key: 'status', header: 'Status', render: (s) => <Pill tone={s.pill}>{s.status}</Pill> },
];

const openItemColumns: Column<OpenItemRow>[] = [
  {
    key: 'item',
    header: 'Item',
    render: (o) => (
      <>
        <div className="label">{o.item}</div>
        {o.detail ? <div className="sub">{o.detail}</div> : null}
      </>
    ),
  },
  { key: 'status', header: 'Status', render: (o) => <Pill tone={o.pill}>{o.status}</Pill> },
];

export function Finances({ data }: { data: FinancesData | undefined }) {
  return (
    <div className="tab-page">
      <div className="page-header">
        <h1>
          Finances <span className="accent">&amp; Admin</span>
        </h1>
        {data?.summary ? <div className="page-sub">{data.summary}</div> : null}
      </div>

      {!data ? (
        <EmptyState label="No finance data yet." />
      ) : (
        <>
          <div className="grid cols-2">
            <Card title="Recurring Payments" badge="Next 30 days">
              <DataTable columns={paymentColumns} rows={data.recurring} getRowId={(p) => p.id} />
            </Card>
            <Card title="Subscriptions" badge="Current">
              <DataTable columns={subscriptionColumns} rows={data.subscriptions} getRowId={(s) => s.id} />
            </Card>
          </div>

          <SectionLabel>Open Financial Items</SectionLabel>
          <div className="card">
            <DataTable columns={openItemColumns} rows={data.openItems} getRowId={(o) => o.id} />
            <InfoBox>{data.accountsNote}</InfoBox>
          </div>
        </>
      )}
    </div>
  );
}
