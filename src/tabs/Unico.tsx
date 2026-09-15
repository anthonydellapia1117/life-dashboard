import type { Account, Contact, UnicoData } from '../types';
import { Card, EmptyState, InfoBox, SectionLabel } from '../components/ui';
import { KpiStrip } from '../components/KpiStrip';
import { DataTable, type Column } from '../components/DataTable';
import { ActionList } from '../components/ActionList';
import { Timeline } from '../components/Timeline';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const accountColumns: Column<Account>[] = [
  { key: 'name', header: 'Account', render: (a) => <span className={a.highlight ? 'label accent-text' : 'label'}>{a.name}</span> },
  {
    key: 'balance',
    header: 'Balance',
    render: (a) => <span className={a.highlight ? 'amount accent-text' : 'amount'}>{currency.format(a.balance)}</span>,
  },
  { key: 'notes', header: 'Notes', render: (a) => <span className="sub">{a.notes ?? ''}</span> },
];

const contactColumns: Column<Contact>[] = [
  { key: 'name', header: 'Name', render: (c) => <span className="label">{c.name}</span> },
  { key: 'role', header: 'Role', render: (c) => <span className="sub">{c.role}</span> },
  { key: 'contact', header: 'Contact', render: (c) => <span className="sub">{c.contact}</span> },
];

export function Unico({ data }: { data: UnicoData | undefined }) {
  return (
    <div className="tab-page">
      <div className="page-header">
        <h1>
          UNICO <span className="accent">Treasurer</span>
        </h1>
        {data?.summary ? <div className="page-sub">{data.summary}</div> : null}
      </div>

      {!data ? (
        <EmptyState label="No UNICO data yet." />
      ) : (
        <>
          <KpiStrip kpis={data.kpis} />

          <div className="grid cols-2">
            <Card title="Treasury Accounts" badge="Latest close">
              <DataTable columns={accountColumns} rows={data.accounts} getRowId={(a) => a.id} />
              <InfoBox>{data.givingNote}</InfoBox>
            </Card>
            <Card title="Action Items" badge="Treasury">
              <ActionList actions={data.actionItems} />
            </Card>
          </div>

          <SectionLabel>Events Calendar</SectionLabel>
          <div className="card">
            <Timeline events={data.events} />
          </div>

          <SectionLabel>Key Contacts</SectionLabel>
          <div className="card">
            <DataTable columns={contactColumns} rows={data.contacts} getRowId={(c) => c.id} />
          </div>
        </>
      )}
    </div>
  );
}
