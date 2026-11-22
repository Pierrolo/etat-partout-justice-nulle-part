/** Minimal CSV helpers for « Télécharger les données » (RFC 4180, UTF-8 with BOM for Excel). */

export type Cell = string | number | boolean | null | undefined;

export interface Column<Row = Record<string, Cell>> {
  /** Key in each row object. */
  key: keyof Row & string;
  /** Header label shown in the table and the CSV. */
  label: string;
  /** Right-align and use tabular figures. */
  numeric?: boolean;
  /** Cell formatter for the HTML table (the CSV always gets the raw value). */
  format?: (value: Cell, row: Row) => string;
}

function escapeCell(v: Cell): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'number' ? String(v) : String(v);
  return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Raw values, `.` as decimal separator, `,` as delimiter: machine-readable on purpose. */
export function toCsv<Row extends Record<string, Cell>>(
  columns: Column<Row>[],
  rows: Row[],
): string {
  const head = columns.map((c) => escapeCell(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => escapeCell(r[c.key])).join(','));
  return [head, ...body].join('\r\n') + '\r\n';
}

/** `data:` URI usable as <a download href>, so the button works without any JavaScript. */
export function csvDataUri(csv: string): string {
  return `data:text/csv;charset=utf-8,${encodeURIComponent('﻿' + csv)}`;
}
