import { ChartFrame } from '@/components/ui/ChartFrame';
import type { ChipProps } from '@/lib/facts';
import { formatInteger, formatNumber } from '@/lib/format';
import type { WorkforceRow } from '@/lib/etat-shared';

const STATUT_COLOR: Record<string, string> = {
  Fonctionnaires: 'var(--series-1)',
  Contractuels: 'var(--series-2)',
  Militaires: 'var(--series-3)',
  'Autres catégories et statuts': 'var(--series-other)',
};
const STATUT_SHORT: Record<string, string> = {
  'Autres catégories et statuts': 'Autres statuts',
};

/**
 * The three fonctions publiques, split by status. Bars share one scale (the State's = 100 %), a
 * 2 px gap separates the statuses; the numbers are written under each bar, not on the marks.
 */
export function Workforce({
  rows,
  totalK,
  year,
  sources,
}: {
  rows: WorkforceRow[];
  totalK: number;
  year: number;
  sources: ChipProps[];
}) {
  const max = Math.max(...rows.map((r) => r.totalK));
  const flat = rows.flatMap((r) =>
    r.statuts.map((s) => ({ versant: r.label, statut: s.statut, milliers: s.k })),
  );
  const statuts = Object.keys(STATUT_COLOR).filter((s) => flat.some((f) => f.statut === s));

  return (
    <ChartFrame
      title={`${formatNumber(totalK / 1000, { decimals: 1 })} millions d’agents publics`}
      subtitle={`Personnes employées au 31 décembre ${year}, en milliers, par fonction publique et par statut.`}
      summary={`Les trois fonctions publiques emploient ${formatNumber(totalK / 1000, { decimals: 2 })} millions de personnes : ${rows
        .map(
          (r) =>
            `${formatNumber(r.totalK / 1000, { decimals: 2 })} M pour ${r.label.toLowerCase()}`,
        )
        .join(
          ', ',
        )}. Les fonctionnaires sont majoritaires partout ; les contractuels pèsent un quart environ.`}
      sources={sources.map((s) => ({ ...s }))}
      table={{
        columns: [
          { key: 'versant', label: 'Fonction publique' },
          { key: 'statut', label: 'Statut' },
          {
            key: 'milliers',
            label: 'Milliers de personnes',
            numeric: true,
            format: (v) => formatNumber(Number(v), { decimals: 1 }),
          },
        ],
        rows: flat,
        caption: 'Effectifs des fonctions publiques par statut',
      }}
      csvFileName="effectifs-publics.csv"
    >
      <ul
        className="mb-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[0.8125rem] text-ink-2"
        aria-label="Légende des statuts"
      >
        {statuts.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block size-3 rounded-[3px]"
              style={{ background: STATUT_COLOR[s] }}
            />
            {STATUT_SHORT[s] ?? s}
          </li>
        ))}
      </ul>
      <div className="space-y-6">
        {rows.map((r) => (
          <div key={r.id}>
            <p className="flex items-start justify-between gap-3">
              <span className="text-[0.9375rem] font-semibold text-ink">{r.label}</span>
              <span className="num shrink-0 whitespace-nowrap font-serif text-xl font-medium leading-snug text-ink">
                {formatInteger(Math.round(r.totalK))}
                <span className="font-sans text-xs font-normal text-ink-3">&nbsp;k</span>
              </span>
            </p>
            <div
              aria-hidden="true"
              className="mt-1.5 flex gap-0.5"
              style={{ width: `${(r.totalK / max) * 100}%`, minWidth: '4rem' }}
            >
              {r.statuts.map((s, i) => (
                <span
                  key={s.statut}
                  className={`h-5 ${i === 0 ? 'rounded-s-[4px]' : ''} ${i === r.statuts.length - 1 ? 'rounded-e-[4px]' : ''}`}
                  style={{
                    flex: `${s.k} 1 0`,
                    background: STATUT_COLOR[s.statut] ?? 'var(--series-other)',
                  }}
                />
              ))}
            </div>
            <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[0.8125rem] text-ink-2">
              {r.statuts.map((s) => (
                <span key={s.statut} className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="inline-block size-2 rounded-full"
                    style={{ background: STATUT_COLOR[s.statut] ?? 'var(--series-other)' }}
                  />
                  {STATUT_SHORT[s.statut] ?? s.statut}{' '}
                  <span className="num font-semibold text-ink">
                    {formatInteger(Math.round(s.k))}
                  </span>
                </span>
              ))}
            </p>
          </div>
        ))}
      </div>
    </ChartFrame>
  );
}
