/**
 * « Crédits retirés » : les 22 amendements d'état B (PLF 2027, seconde partie), mission par mission.
 * Deux barres par mission — crédits de paiement (CP) et autorisations d'engagement (AE), même unité,
 * même axe — triées par CP décroissants ; chaque ligne se déplie sur ses programmes.
 *
 * Statique (aucun JavaScript) : <details> natifs, valeurs écrites au bout des barres.
 */
import { BarLegend } from './bars';
import { IconChevron } from '@/components/ui/icons';
import { formatCompactEuro, formatInteger, formatPercentPoints } from '@/lib/format';
import { formatDateFr } from '@/lib/dates';

export interface CreditProgramme {
  name: string;
  cpEur: number;
  aeEur: number;
}

export interface CreditMission {
  /** Numéro de l'amendement PLF-P2 (1 à 22). */
  number: number;
  mission: string;
  cpEur: number;
  aeEur: number;
  /** Part du total des CP retirés, en %. */
  cpSharePct: number;
  programmes: CreditProgramme[];
  effets: Array<{ appliesTo: string; date: string }>;
  pdfUrl: string;
}

const CP = 'var(--seq-7)';
const AE = 'var(--seq-4)';
const VALUE_W = '7.75rem';

function DualBars({
  cp,
  ae,
  max,
  thickness = 12,
}: {
  cp: number;
  ae: number;
  max: number;
  thickness?: number;
}) {
  const row = (label: string, v: number, color: string) => {
    const ratio = Math.min(1, v / max);
    return (
      <div className="flex min-w-0 items-center gap-2" style={{ height: thickness }}>
        <div
          aria-hidden="true"
          className="shrink-0 forced-color-adjust-none"
          style={{
            width: `calc((100% - ${VALUE_W}) * ${ratio.toFixed(5)})`,
            minWidth: v > 0 ? 3 : 0,
            height: thickness,
            background: color,
            borderRadius: '0 4px 4px 0',
          }}
        />
        <span className="num shrink-0 whitespace-nowrap text-sm font-semibold text-ink">
          <span className="me-1 text-xs font-normal text-ink-3">{label}</span>
          {formatCompactEuro(v)}
        </span>
      </div>
    );
  };
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {row('CP', cp, CP)}
      {row('AE', ae, AE)}
    </div>
  );
}

export default function CreditsChart({
  missions,
  amendementsHref,
}: {
  missions: CreditMission[];
  amendementsHref: string;
}) {
  const sorted = [...missions].sort((a, b) => b.cpEur - a.cpEur);
  const max = Math.max(...sorted.map((m) => Math.max(m.cpEur, m.aeEur)));
  return (
    <div className="space-y-4">
      <BarLegend
        label="Légende"
        items={[
          { label: 'Crédits de paiement (CP) : ce que l’État décaisse', color: CP },
          { label: 'Autorisations d’engagement (AE) : ce qu’il peut promettre', color: AE },
        ]}
      />
      <ol
        aria-label="Crédits retirés par mission, du plus gros au plus petit"
        className="m-0 list-none divide-y divide-rule border-y border-rule p-0"
      >
        {sorted.map((m, i) => {
          const pmax = Math.max(...m.programmes.map((p) => Math.max(p.cpEur, p.aeEur)), 1);
          return (
            <li key={m.number}>
              <details className="group/m">
                <summary className="grid min-h-14 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-1 py-2.5 marker:content-none hover:bg-sunken/70 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto] [&::-webkit-details-marker]:hidden">
                  <span className="grid min-w-0 grid-cols-[1.75rem_minmax(0,1fr)] text-[0.9375rem] leading-snug text-ink">
                    <span aria-hidden="true" className="num text-sm text-ink-3">
                      {i + 1}.
                    </span>
                    <span>
                      {m.mission}
                      <span className="block text-xs text-ink-3">
                        {formatInteger(m.programmes.length)} programme
                        {m.programmes.length > 1 ? 's' : ''} ·{' '}
                        {formatPercentPoints(m.cpSharePct, { decimals: { min: 0, max: 1 } })} des CP
                      </span>
                    </span>
                  </span>
                  <IconChevron
                    size={18}
                    className="justify-self-end text-ink-3 transition-transform group-open/m:rotate-180 sm:order-last"
                  />
                  <div className="col-span-2 min-w-0 sm:col-span-1">
                    <DualBars cp={m.cpEur} ae={m.aeEur} max={max} />
                  </div>
                </summary>
                <div className="space-y-3 bg-sunken/50 px-3 pb-4 pt-3 sm:px-5">
                  <ul className="m-0 list-none space-y-3 p-0">
                    {m.programmes.map((p) => (
                      <li
                        key={p.name}
                        className="grid gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] sm:items-center"
                      >
                        <span className="text-sm leading-snug text-ink-2">{p.name}</span>
                        <DualBars cp={p.cpEur} ae={p.aeEur} max={pmax} thickness={8} />
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-ink-2">
                    <span className="font-semibold text-ink">Effet : </span>
                    {m.effets.map((e, k) => (
                      <span key={k}>
                        {k > 0 && ' ; '}
                        {formatDateFr(e.date)} ({e.appliesTo})
                      </span>
                    ))}
                    .
                  </p>
                  <p className="flex flex-wrap gap-x-4 text-sm">
                    <a href={`${amendementsHref}#PLF-P2-${m.number}`}>
                      Amendement PLF-P2 n° {m.number}
                    </a>
                    <a href={m.pdfUrl} target="_blank" rel="noopener noreferrer">
                      Lire le texte (PDF)
                      <span className="sr-only"> (s’ouvre dans un nouvel onglet)</span>
                    </a>
                  </p>
                </div>
              </details>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
