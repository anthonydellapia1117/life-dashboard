import { EmptyState } from './ui';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
}

/**
 * Generic table that collapses to stacked cards under 640px via CSS
 * (data-label attributes drive the mobile layout - see global.css).
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  emptyLabel,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  getRowId: (row: T) => string;
  emptyLabel?: string;
}) {
  if (!rows || rows.length === 0) return <EmptyState label={emptyLabel} />;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>
                <span className="th-label">{c.header}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowId(row)}>
              {columns.map((c) => (
                <td key={c.key} data-label={c.header}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
