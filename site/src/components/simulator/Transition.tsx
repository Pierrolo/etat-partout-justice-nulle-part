import { useMemo } from 'react';
import { Button, ChartFrame } from '@/components/ui';
import { IconDown, IconUp } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { compare, roundForDisplay as displayOf } from '@/lib/engine';
import type { Comparison, Household, Hypotheses, Period } from '@/lib/engine-types';
import { formatEuro, formatEuroDelta, roundForDisplay } from '@/lib/format';
import { withBase } from '@/lib/site';
import { DISPLAY_STEP, headlinePct, pctText } from '@/lib/sim/result';

const PHOTOS: Period[] = [2027, 2028, 2030, 'steady'];
const SOURCES = [
  { label: 'Calendrier des mesures du plan', href: withBase('/comprendre/calendrier/') },
];

interface Photo {
  period: Period;
  cmp: Comparison;
  delta: number;
  plan: number;
  /** `null` when today's income is almost nil: shown « — ». */
  pct: number | null;
  drivers: Array<{ label: string; delta: number }>;
}

const key = (c: { id: string; personIndex?: number }) => `${c.id}|${c.personIndex ?? ''}`;

function drivers(prev: Comparison | null, cmp: Comparison): Photo['drivers'] {
  if (!prev) {
    const fig = displayOf(cmp);
    return cmp.waterfall
      .map((w, i) => ({ label: w.label, delta: fig.waterfall[i]?.delta ?? 0 }))
      .filter((d) => d.delta !== 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 2);
  }
  const before = new Map(prev.plan.components.map((c) => [key(c), c]));
  const out: Photo['drivers'] = [];
  for (const c of cmp.plan.components) {
    const d = c.amount - (before.get(key(c))?.amount ?? 0);
    const r = roundForDisplay(d, DISPLAY_STEP);
    if (r !== 0) out.push({ label: c.label, delta: r });
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 2);
}

export interface TransitionProps {
  household: Household;
  hypotheses: Hypotheses;
  period: Period;
  onPick: (p: Period) => void;
}

/**
 * « La transition en 3 photos »: the plan's dated measures at 2027, 2028 and 2030, then the full plan.
 * Four small multiples that share one scale, so a dip in 2027 and a gain in 2030 read at a glance.
 */
export function Transition({ household, hypotheses, period, onPick }: TransitionProps) {
  const photos = useMemo<Photo[]>(() => {
    let prev: Comparison | null = null;
    return PHOTOS.map((p) => {
      const cmp = compare(household, { period: p, hypotheses });
      const fig = displayOf(cmp);
      const photo: Photo = {
        period: p,
        cmp,
        delta: fig.deltaAfterTva,
        plan: fig.planAfterTva,
        pct: headlinePct(cmp),
        drivers: drivers(prev, cmp),
      };
      prev = cmp;
      return photo;
    });
  }, [household, hypotheses]);

  const maxAbs = Math.max(1, ...photos.map((p) => Math.abs(p.delta)));
  const label = (p: Period) => (p === 'steady' ? 'Plan complet' : String(p));
  const signs = new Set(photos.map((p) => Math.sign(p.delta)));
  const summary = (
    <>
      Écart de revenu disponible par rapport à aujourd’hui :{' '}
      {photos.map((p, i) => (
        <span key={String(p.period)}>
          {i > 0 && (i === photos.length - 1 ? ' et ' : ', ')}
          {p.period === 'steady' ? 'plan complet' : p.period}&nbsp;: {formatEuroDelta(p.delta)} par
          mois
        </span>
      ))}
      .{' '}
      {signs.has(-1) && signs.has(1)
        ? 'Le chemin n’est pas régulier : le signe de l’écart change selon l’année.'
        : 'Les mesures arrivant par étapes, l’écart évolue d’année en année.'}
    </>
  );

  return (
    <ChartFrame
      headingLevel={4}
      title="Année après année, jusqu’au plan complet"
      subtitle="Votre ménage en 2027, en 2028, en 2030, puis avec le plan complet. Même échelle pour les quatre."
      summary={summary}
      sources={SOURCES}
      csvFileName="transition-2027-2030.csv"
      table={{
        caption: 'Revenu disponible mensuel et écart avec aujourd’hui, par année',
        columns: [
          { key: 'year', label: 'Année' },
          {
            key: 'plan',
            label: 'Revenu disponible (€/mois)',
            numeric: true,
            format: (v) => formatEuro(Number(v)),
          },
          {
            key: 'delta',
            label: 'Écart (€/mois)',
            numeric: true,
            format: (v) => formatEuroDelta(Number(v)),
          },
          {
            key: 'pct',
            label: 'Écart (%)',
            numeric: true,
            format: (v) => pctText(v === null ? null : Number(v)),
          },
        ],
        rows: photos.map((p) => ({
          year: p.period === 'steady' ? 'Plan complet' : String(p.period),
          plan: p.plan,
          delta: p.delta,
          pct: p.pct,
        })),
      }}
      note="Euros de 2026, sans inflation. Le gel de l’indexation des pensions et des prestations n’est pas chiffré. Le plan complet est le régime de croisière, tel qu’il serait une fois toutes les mesures en place."
    >
      <ol className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {photos.map((p) => {
          const dir = p.delta > 0 ? 'gain' : p.delta < 0 ? 'loss' : 'flat';
          const active = period === p.period;
          const Icon = dir === 'loss' ? IconDown : IconUp;
          return (
            <li
              key={String(p.period)}
              data-testid={`photo-${p.period}`}
              className={cn(
                'flex min-w-0 flex-col gap-3 rounded-lg border-[1.5px] p-4',
                active ? 'border-accent bg-accent-soft/50' : 'border-rule bg-surface',
              )}
            >
              <h3 className="font-serif text-lg font-medium text-ink">{label(p.period)}</h3>
              <p
                className={cn(
                  'flex items-center gap-1.5 font-serif text-2xl font-medium sm:text-3xl',
                  dir === 'gain' ? 'text-gain' : dir === 'loss' ? 'text-loss' : 'text-ink',
                )}
              >
                {dir !== 'flat' && <Icon size={18} strokeWidth={2} className="shrink-0" />}
                <span className="num nums-proportional">{formatEuroDelta(p.delta)}</span>
              </p>
              <p className="-mt-2 text-xs text-ink-3">par mois, avec {pctText(p.pct)}</p>
              <span aria-hidden="true" className="relative block h-3 rounded-full bg-sunken">
                <span className="absolute inset-y-0 left-1/2 w-px bg-[var(--chart-axis)]" />
                <span
                  className={cn(
                    'absolute inset-y-0.5 rounded-full',
                    dir === 'loss' ? 'bg-loss-mark' : 'bg-gain-mark',
                  )}
                  style={
                    p.delta >= 0
                      ? { left: '50%', width: `${(p.delta / maxAbs) * 50}%` }
                      : { right: '50%', width: `${(Math.abs(p.delta) / maxAbs) * 50}%` }
                  }
                />
              </span>
              <p className="text-sm text-ink-2">
                Revenu disponible :{' '}
                <span className="num font-semibold text-ink">{formatEuro(p.plan)}</span>
              </p>
              <div className="text-xs text-ink-2">
                <p className="font-semibold text-ink-3">
                  {p.period === 2027 ? 'Ce qui change' : 'Ce qui change depuis la photo précédente'}
                </p>
                {p.drivers.length === 0 ? (
                  <p className="mt-0.5">Rien de nouveau.</p>
                ) : (
                  <ul className="mt-0.5 space-y-0.5">
                    {p.drivers.map((d) => (
                      <li key={d.label}>
                        {d.label}{' '}
                        <span className="num font-semibold text-ink">
                          {formatEuroDelta(d.delta)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Button
                variant={active ? 'primary' : 'secondary'}
                size="sm"
                aria-pressed={active}
                onClick={() => onPick(p.period)}
                className="mt-auto"
              >
                {active ? 'Vue actuelle' : 'Détailler'}
              </Button>
            </li>
          );
        })}
      </ol>
    </ChartFrame>
  );
}
