import { formatWeekdayMonthDayISO } from '../lib/date';
import type { FamilyData, FamilyRow, TripRow } from '../types';
import { Card, EmptyState, InfoBox, Pill, SectionLabel } from '../components/ui';
import { DataTable, type Column } from '../components/DataTable';
import { Timeline } from '../components/Timeline';

const familyRowColumns: Column<FamilyRow>[] = [
  {
    key: 'item',
    header: 'Item',
    render: (r) => (
      <>
        <div className="label">{r.item}</div>
        {r.detail ? <div className="sub">{r.detail}</div> : null}
      </>
    ),
  },
  { key: 'date', header: 'Date', render: (r) => <span className="mono">{formatWeekdayMonthDayISO(r.date)}</span> },
  { key: 'status', header: 'Status', render: (r) => <Pill tone={r.pill}>{r.status}</Pill> },
];

const tripColumns: Column<TripRow>[] = [
  { key: 'item', header: 'Item', render: (t) => <span className="label">{t.item}</span> },
  { key: 'detail', header: 'Detail', render: (t) => <span className="sub">{t.detail}</span> },
];

export function Family({ data }: { data: FamilyData | undefined }) {
  return (
    <div className="tab-page">
      {data?.summary ? <p className="section-summary">{data.summary}</p> : null}

      {!data ? (
        <EmptyState label="No family data yet." />
      ) : (
        <>
          <div className="grid cols-2">
            <Card title="Child">
              <DataTable columns={familyRowColumns} rows={data.child} getRowId={(r) => r.id} />
              {data.childNote ? <InfoBox>{data.childNote}</InfoBox> : null}
            </Card>
            <Card title="Upcoming Trip">
              <DataTable columns={tripColumns} rows={data.trip} getRowId={(t) => t.id} />
              {data.tripNote ? <InfoBox>{data.tripNote}</InfoBox> : null}
            </Card>
          </div>

          <SectionLabel>Personal Health &amp; Milestones</SectionLabel>
          <div className="grid cols-2">
            <Card title="Health">
              <DataTable columns={familyRowColumns} rows={data.health} getRowId={(r) => r.id} />
              {data.healthNote ? <InfoBox>{data.healthNote}</InfoBox> : null}
            </Card>
            <Card title="Family Milestones" badge="Upcoming">
              <Timeline events={data.milestones} />
              {data.milestonesNote ? <InfoBox>{data.milestonesNote}</InfoBox> : null}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
