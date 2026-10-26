import { cn } from '@/lib/cn';
import type { Cell, Column } from '@/lib/csv';

export interface DataTableProps<Row extends Record<string, Cell>> {
  columns: Column<Row>[];
  rows: Row[];
  /** Visible or screen-reader caption naming the table. */
  caption: string;
  /** Hide the caption visually (it is still announced). Default true. */
  captionHidden?: boolean;
  /** Column key to render as the row header (<th scope="row">). Default: first column. */
  rowHeader?: (keyof Row & string) | null;
  className?: string;
}

const defaultFormat = (v: Cell) =>
  v === null || v === undefined ? '—' : typeof v === 'number' ? String(v) : String(v);

/** Accessible table with tabular figures; scrolls horizontally (focusable) on narrow screens. */
export function DataTable<Row extends Record<string, Cell>>({
  columns,
  rows,
  caption,
  captionHidden = true,
  rowHeader,
  className,
}: DataTableProps<Row>) {
  const headerKey = rowHeader === undefined ? columns[0]?.key : rowHeader;
  return (
    <div
      role="region"
      aria-label={`Tableau : ${caption}`}
      tabIndex={0}
      className={cn(
        'max-w-full overflow-x-auto rounded-md border border-rule bg-surface',
        className,
      )}
    >
      <table className="data-table">
        <caption className={captionHidden ? 'sr-only' : undefined}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" data-numeric={c.numeric ? '' : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => {
                const text = (c.format ?? defaultFormat)(row[c.key], row);
                return c.key === headerKey ? (
                  <th key={c.key} scope="row" className="font-medium text-ink">
                    {text}
                  </th>
                ) : (
                  <td key={c.key} data-numeric={c.numeric ? '' : undefined}>
                    {text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
