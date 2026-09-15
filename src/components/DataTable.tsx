import { EmptyState } from './ui';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
}

/**
 * Generic table. Under 640px it collapses via CSS: a table of up to 3
 * columns becomes a compact list (name left, value right, the middle column
 * as a second line), anything wider becomes labelled stacked cards
 * (data-label attributes drive that layout - see global.css).
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
    <div className={columns.length <= 3 ? 'table-wrap compact' : 'table-wrap'}>
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
