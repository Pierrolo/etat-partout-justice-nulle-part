import { ChartFrame } from '@/components/ui/ChartFrame';
import type { ChipProps } from '@/lib/facts';
import { formatInteger } from '@/lib/format';
import { FATE_LABEL, type FateCount } from '@/lib/etat-shared';
import { UnitGrid, type UnitSegment } from './UnitGrid';
import './story.css';

const COLOR = {
  suppression: 'var(--series-1)',
  cession: 'var(--series-4)',
  internalisation: 'var(--series-3)',
  autonomie: 'var(--series-other)',
} as const;

/** 1 104 agences d'État, one square each, coloured by their fate in the plan (the authors' proposal). */
export function AgencyWaffle({
  fates,
  sources,
  lawCount,
  lawDate,
}: {
  fates: FateCount[];
  sources: ChipProps[];
  lawCount: number;
  lawDate: string;
}) {
  const total = fates.reduce((a, f) => a + f.n, 0);
  const closed = fates
    .filter((f) => f.id === 'suppression' || f.id === 'cession')
    .reduce((a, f) => a + f.n, 0);
  const kept = fates.find((f) => f.id === 'autonomie')!.n;
  const segments: UnitSegment[] = fates.map((f) => ({
    id: f.id,
    label: FATE_LABEL[f.id],
    count: f.n,
    color: COLOR[f.id],
    detail:
      f.parts.length > 0
        ? `dont ${f.parts.map((p) => `${formatInteger(p.n)} ${p.label}`).join(', ')}`
        : undefined,
  }));

  return (
    <ChartFrame
      tier="announced"
      title={`Le sort des ${formatInteger(total)} agences d’État`}
      subtitle="Un carré = une agence, un opérateur, une autorité ou une commission. Sort proposé."
      summary={`Sur ${formatInteger(total)} agences, ${formatInteger(closed)} seraient fermées (supprimées ou cédées), ${formatInteger(fates.find((f) => f.id === 'internalisation')!.n)} intégrées à un ministère et ${formatInteger(kept)} resteraient autonomes. Seule la liste de ${formatInteger(lawCount)} entités de l’amendement PLF-P2 n° 25 (au ${lawDate}) a valeur de loi.`}
      sources={sources.map((s) => ({ ...s }))}
      table={{
        columns: [
          { key: 'sort', label: 'Sort' },
          { key: 'n', label: 'Agences', numeric: true, format: (v) => formatInteger(Number(v)) },
          { key: 'dont', label: 'Origine' },
        ],
        rows: fates.map((f) => ({
          sort: FATE_LABEL[f.id],
          n: f.n,
          dont: f.parts.map((p) => `${formatInteger(p.n)} ${p.label}`).join(', '),
        })),
        caption: 'Sort des agences d’État dans le plan',
      }}
      csvFileName="agences-sort.csv"
    >
      <UnitGrid
        segments={segments}
        colsWide={60}
        colsNarrow={32}
        ariaLabel={`${formatInteger(total)} carrés : ${segments.map((s) => `${formatInteger(s.count)} ${s.label.toLowerCase()}`).join(', ')}`}
      />
    </ChartFrame>
  );
}
