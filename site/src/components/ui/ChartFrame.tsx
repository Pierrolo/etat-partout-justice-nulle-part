import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { csvDataUri, toCsv, type Cell, type Column } from '@/lib/csv';
import type { Tier } from '@/lib/tiers';
import { DataTable } from './DataTable';
import { Disclosure } from './Disclosure';
import { IconDownload } from './icons';
import { SourceChip, type SourceChipProps } from './SourceChip';
import { TierBadge } from './TierBadge';

export interface ChartFrameProps<Row extends Record<string, Cell>> {
  title: string;
  subtitle?: ReactNode;
  /** Heading level of the title (default 3: pages own the h1/h2). */
  headingLevel?: 2 | 3 | 4;
  /**
   * REQUIRED plain-language reading of the chart: the main finding in one or two sentences.
   * Rendered visibly under the chart and wired with aria-describedby — not an alt-text afterthought.
   */
  summary: ReactNode;
  /** The chart itself (SVG from Observable Plot / d3, or an HTML figure). */
  children: ReactNode;
  /** Source(s) of the data. Required: no unsourced chart. */
  sources: SourceChipProps[];
  /** Underlying data: powers « Voir les données » and the CSV download. Strongly recommended. */
  table?: { columns: Column<Row>[]; rows: Row[]; caption?: string };
  /** CSV file name (default derived from the title). */
  csvFileName?: string;
  /**
   * `'none'` keeps the CSV download but hides the « Voir les données » dépliant — for charts that
   * already carry their own Graphique · Tableau · Sources tabs (the table must then live in the tabs).
   */
  tableView?: 'disclosure' | 'none';
  /** Tier of the whole chart (e.g. `announced` for a chart that only shows authors' promises). */
  tier?: Tier;
  /** Footnote: method, caveats, definitions. */
  note?: ReactNode;
  className?: string;
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Standard wrapper for every chart (OWID pattern, a11y-first):
 * title · subtitle · chart · visible text summary · source line · « Voir les données » (table) ·
 * « Télécharger (CSV) ». Works without JavaScript (native <details>, `data:` URI download).
 */
export function ChartFrame<Row extends Record<string, Cell>>({
  title,
  subtitle,
  headingLevel = 3,
  summary,
  children,
  sources,
  table,
  csvFileName,
  tableView = 'disclosure',
  tier,
  note,
  className,
}: ChartFrameProps<Row>) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const summaryId = `${uid}-summary`;
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  const csvHref = table ? csvDataUri(toCsv(table.columns, table.rows)) : undefined;

  return (
    <figure className={cn('card flex flex-col gap-4', className)} aria-labelledby={titleId}>
      <header className="space-y-1.5">
        {tier && <TierBadge tier={tier} size="sm" />}
        <Heading
          id={titleId}
          className="font-serif text-xl font-medium leading-snug tracking-tight text-ink sm:text-2xl"
        >
          {title}
        </Heading>
        {subtitle && <p className="text-[0.9375rem] text-ink-2">{subtitle}</p>}
      </header>

      <div role="group" aria-labelledby={titleId} aria-describedby={summaryId} className="min-w-0">
        {children}
      </div>

      <p id={summaryId} className="text-[0.9375rem] leading-relaxed text-ink-2">
        <span className="font-semibold text-ink">Lecture. </span>
        {summary}
      </p>

      {note && <p className="text-xs leading-relaxed text-ink-3">{note}</p>}

      <footer className="flex flex-col gap-3 border-t border-rule pt-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-ink-3">
          <span className="font-semibold">{sources.length > 1 ? 'Sources' : 'Source'}&nbsp;:</span>
          {sources.map((s, i) => (
            <SourceChip key={i} {...s} />
          ))}
        </p>
        {csvHref && (
          <a
            href={csvHref}
            download={csvFileName ?? `${slug(title)}.csv`}
            className="btn btn-secondary btn-sm shrink-0 self-start"
          >
            <IconDownload size={14} />
            Télécharger (CSV)
          </a>
        )}
      </footer>

      {table && tableView === 'disclosure' && (
        <Disclosure
          summary="Voir les données"
          meta={`${table.rows.length} lignes`}
          className="-mt-1"
        >
          <DataTable columns={table.columns} rows={table.rows} caption={table.caption ?? title} />
        </Disclosure>
      )}
    </figure>
  );
}
