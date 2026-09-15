import type { CareerData, LogEntry, TrackedItem } from '../types';
import { Card, EmptyState, InfoBox, Pill, SectionLabel } from '../components/ui';
import { KpiStrip } from '../components/KpiStrip';
import { DataTable, type Column } from '../components/DataTable';
import { formatDate } from '../lib/date';

// Every heading and label here comes from the encrypted data (CareerData.labels),
// so this public file says nothing about what the tab tracks.

function itemColumns(valueHeader: string | undefined): Column<TrackedItem>[] {
  const cols: Column<TrackedItem>[] = [
    {
      key: 'name',
      header: 'Item',
      render: (o) => (
        <>
          <div className="label">{o.name}</div>
          {o.detail ? <div className="sub">{o.detail}</div> : null}
        </>
      ),
    },
  ];
  if (valueHeader) cols.push({ key: 'value', header: valueHeader, render: (o) => <span className="mono">{o.value ?? '-'}</span> });
  cols.push({ key: 'status', header: 'Status', render: (o) => <Pill tone={o.pill}>{o.status}</Pill> });
  return cols;
}

function logColumns(nameHeader: string, detailHeader: string): Column<LogEntry>[] {
  return [
    { key: 'date', header: 'Date', render: (l) => <span className="mono">{formatDate(l.date)}</span> },
    { key: 'name', header: nameHeader, render: (l) => <span className="label">{l.name}</span> },
    { key: 'detail', header: detailHeader, render: (l) => <span className="sub">{l.detail}</span> },
    { key: 'source', header: 'Source', render: (l) => <span className="sub">{l.source}</span> },
  ];
}

export function Career({ data }: { data: CareerData | undefined }) {
  const labels = data?.labels ?? {};
  return (
    <div className="tab-page">
      {data?.summary ? <p className="section-summary">{data.summary}</p> : null}

      {!data ? (
        <EmptyState label="Nothing here yet." />
      ) : (
        <>
          <KpiStrip kpis={data.kpis} />

          <div className="grid cols-2">
            <Card title={labels.open ?? 'Open'} badge={labels.openBadge}>
              <DataTable columns={itemColumns(labels.value)} rows={data.open} getRowId={(o) => o.id} />
              {data.notes.length > 0 ? (
                <InfoBox>
                  {data.notes.map((n, i) => (
                    <span key={n.label}>
                      {i > 0 ? <br /> : null}
                      <strong className="hl">{n.label}:</strong> {n.text}
                    </span>
                  ))}
                </InfoBox>
              ) : null}
            </Card>
            <Card title={labels.log ?? 'Log'} badge={labels.logBadge}>
              <DataTable
                columns={logColumns(labels.logName ?? 'Name', labels.logDetail ?? 'Detail')}
                rows={data.log}
                getRowId={(l) => l.id}
              />
              {data.logNote ? <InfoBox>{data.logNote}</InfoBox> : null}
            </Card>
          </div>

          <SectionLabel>{labels.closed ?? 'Closed'}</SectionLabel>
          <div className="card">
            <DataTable columns={itemColumns(undefined)} rows={data.closed} getRowId={(o) => o.id} />
          </div>
        </>
      )}
    </div>
  );
}
