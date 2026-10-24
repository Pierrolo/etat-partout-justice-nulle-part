import { useMemo, useState } from 'react';
import { ChartFrame } from '@/components/ui/ChartFrame';
import { DataTable } from '@/components/ui/DataTable';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Tabs } from '@/components/ui/Tabs';
import type { Column } from '@/lib/csv';
import type { ChipProps } from '@/lib/facts';
import { formatEuro, formatMdEuro, formatNumber, formatPercentPoints } from '@/lib/format';
import { cofogRows, GROUP_SHORT, type CofogNode } from '@/lib/story-shared';
import {
  UNIT_LABEL,
  UNIT_ORDER,
  UNIT_SHORT,
  convertMd,
  type Denominators,
  type UnitKey,
} from '@/lib/units';
import { CofogBars } from './CofogBars';
import { CofogTreemap } from './CofogTreemap';
import { SourceList, type SourceItem } from './SourceList';

export interface DepensesExplorerProps {
  tree: CofogNode;
  den: Denominators;
  /** Plain-text statements of the two denominators, with their provenance (from facts.json). */
  denominatorNotes: { foyer: string; habitant: string };
  sources: ChipProps[];
  sourceItems: SourceItem[];
  gaps: string[];
  year: number;
}

type TableRow = {
  niveau: string;
  poste: string;
  parent: string;
  md: number;
  part: number;
  foyer_an: number;
  foyer_jour: number;
  habitant_an: number;
};

/**
 * The page's filter row (unit toggle) + the zoomable treemap with OWID-style tabs
 * (Graphique · Tableau · Sources). The unit scopes every number below it.
 */
export function DepensesExplorer({
  tree,
  den,
  denominatorNotes,
  sources,
  sourceItems,
  gaps,
  year,
}: DepensesExplorerProps) {
  const [unit, setUnit] = useState<UnitKey>('foyer-jour');
  const [tab, setTab] = useState('graphique');

  const rows = useMemo<TableRow[]>(
    () =>
      cofogRows(tree).map((r) => ({
        niveau: r.niveau,
        poste: r.poste,
        parent: r.parent,
        md: r.valeur_md,
        part: r.part_pct,
        foyer_an: convertMd(r.valeur_md, 'foyer-an', den),
        foyer_jour: convertMd(r.valeur_md, 'foyer-jour', den),
        habitant_an: convertMd(r.valeur_md, 'habitant-an', den),
      })),
    [tree, den],
  );

  const columns: Column<TableRow>[] = [
    { key: 'poste', label: 'Poste' },
    { key: 'niveau', label: 'Niveau' },
    { key: 'parent', label: 'Dans' },
    {
      key: 'md',
      label: 'Md€ par an',
      numeric: true,
      format: (v) => formatNumber(Number(v), { decimals: 1 }),
    },
    {
      key: 'part',
      label: 'Part',
      numeric: true,
      format: (v) => formatPercentPoints(Number(v), { decimals: 1 }),
    },
    {
      key: 'foyer_an',
      label: '€ par foyer et par an',
      numeric: true,
      format: (v) => formatEuro(Number(v)),
    },
    {
      key: 'foyer_jour',
      label: '€ par foyer et par jour',
      numeric: true,
      format: (v) => formatEuro(Number(v), { decimals: Number(v) < 10 ? 2 : 0 }),
    },
    {
      key: 'habitant_an',
      label: '€ par habitant et par an',
      numeric: true,
      format: (v) => formatEuro(Number(v)),
    },
  ];

  const groups = [...(tree.children ?? [])].sort((a, b) => b.value - a.value);
  const top = groups[0]!;
  const secu = groups.find((g) => g.id === 'securite');

  return (
    <div className="space-y-4">
      {/* One filter row above the chart it scopes. */}
      <div className="card space-y-3 bg-sunken">
        <SegmentedControl<UnitKey>
          legend="Dire les montants…"
          options={UNIT_ORDER.map((u) => ({ value: u, label: UNIT_LABEL[u] }))}
          value={unit}
          onChange={setUnit}
          size="sm"
        />
        <p className="text-sm leading-relaxed text-ink-2" aria-live="polite">
          <span className="font-semibold text-ink">{UNIT_SHORT[unit]}.</span>{' '}
          {unit === 'foyer-an' || unit === 'foyer-jour'
            ? denominatorNotes.foyer
            : unit === 'habitant-an'
              ? denominatorNotes.habitant
              : `Montant national des administrations publiques en ${year} : ${formatMdEuro(tree.value)}.`}
        </p>
      </div>

      <ChartFrame
        title={`Où vont les ${formatMdEuro(tree.value)} de dépenses publiques ?`}
        subtitle={`Surface proportionnelle au montant, ${year} · unité : ${UNIT_SHORT[unit]}. Six groupes du livre, puis leurs postes, puis les fonctions COFOG de l’Insee.`}
        summary={`« ${GROUP_SHORT[top.id] ?? top.label} » pèse ${formatPercentPoints((top.value / tree.value) * 100, { decimals: 0 })} de la dépense (${formatMdEuro(top.value)}).${
          secu
            ? ` La sécurité — défense, police, justice — en représente ${formatPercentPoints((secu.value / tree.value) * 100, { decimals: 1 })}.`
            : ''
        } Touchez un groupe pour zoomer.`}
        sources={sources.map((s) => ({ ...s }))}
        table={{ columns, rows, caption: `Dépenses publiques ${year} par fonction` }}
        csvFileName="depenses-publiques-2024-par-fonction.csv"
        tableView="none"
        headingLevel={2}
      >
        <Tabs
          label="Affichage du graphique"
          value={tab}
          onValueChange={setTab}
          keepMounted
          tabs={[
            {
              id: 'graphique',
              label: 'Graphique',
              content: (
                <>
                  <CofogTreemap tree={tree} unit={unit} den={den} />
                  <CofogBars tree={tree} unit={unit} den={den} />
                </>
              ),
            },
            {
              id: 'tableau',
              label: 'Tableau',
              content: (
                <DataTable
                  columns={columns}
                  rows={rows}
                  caption={`Dépenses publiques ${year} par fonction : montants dans les quatre unités`}
                  className="max-h-[32rem] overflow-y-auto [&_thead_th]:sticky [&_thead_th]:top-0"
                />
              ),
            },
            {
              id: 'sources',
              label: 'Sources',
              content: <SourceList items={sourceItems} gaps={gaps} />,
            },
          ]}
        />
      </ChartFrame>
    </div>
  );
}
