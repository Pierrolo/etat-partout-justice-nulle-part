import { ticks } from 'd3';
import { useId, useMemo, useState, type CSSProperties } from 'react';
import { Button, ChartFrame, SourceChip, TierBadge } from '@/components/ui';
import { IconChevron, IconDown, IconUp } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import type { Comparison, Tier } from '@/lib/engine-types';
import { formatEuro, formatEuroDelta } from '@/lib/format';
import { TIER_META } from '@/lib/tiers';
import { barBox, buildBridge, displayFigures, zeroLeft } from '@/lib/sim/result';

const SOURCES = [{ label: 'Moteur de calcul du simulateur', tier: 'law' as const }];

/** Fill for a bar: solid (law), hatched + dashed outline (announced), dotted outline (hypothesis). */
function barStyle(tier: Tier, positive: boolean): CSSProperties {
  const c = positive ? 'var(--gain)' : 'var(--loss)';
  if (tier === 'announced')
    return {
      backgroundImage: `repeating-linear-gradient(135deg, ${c} 0 2px, transparent 2px 6px)`,
      backgroundColor: `color-mix(in oklab, ${c} 14%, transparent)`,
      border: `1.5px dashed ${c}`,
    };
  if (tier === 'hypothesis')
    return {
      backgroundColor: `color-mix(in oklab, ${c} 38%, transparent)`,
      border: `2px dotted ${c}`,
    };
  return { backgroundColor: c };
}

const GRID =
  'grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 sm:grid-cols-[minmax(10rem,15rem)_minmax(0,1fr)_8.25rem]';

export interface WaterfallProps {
  comparison: Comparison;
  /** Moves the cursor of the page: used to wire « Détailler cette année ». */
  periodLabel: string;
}

export function Waterfall({ comparison, periodLabel }: WaterfallProps) {
  const uid = useId();
  const fig = useMemo(() => displayFigures(comparison), [comparison]);
  const steps = useMemo(
    () =>
      comparison.waterfall.map((w, i) => ({ ...w, key: `${w.id}#${i}`, shown: fig.steps[i] ?? 0 })),
    [comparison, fig],
  );
  const bridge = useMemo(() => buildBridge(steps.map((s) => ({ ...s, delta: s.shown }))), [steps]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const allOpen = steps.length > 0 && open.size === steps.length;

  const axis = useMemo(() => {
    const raw = ticks(bridge.min, bridge.max, 4).filter((t) => t >= bridge.min && t <= bridge.max);
    return raw.map((t) => ({ t, left: barBox(bridge, t, t).left }));
  }, [bridge]);
  const zero = zeroLeft(bridge);

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const best = steps.reduce<(typeof steps)[number] | null>(
    (b, s) => (s.shown > 0 && (!b || s.shown > b.shown) ? s : b),
    null,
  );
  const worst = steps.reduce<(typeof steps)[number] | null>(
    (b, s) => (s.shown < 0 && (!b || s.shown < b.shown) ? s : b),
    null,
  );
  const summary = (
    <>
      Votre revenu disponible passe de {formatEuro(fig.baseline)} à {formatEuro(fig.plan)} par mois
      ({formatEuroDelta(fig.delta)}).{' '}
      {best
        ? `La plus forte hausse vient de « ${best.label} » (${formatEuroDelta(best.shown)}). `
        : 'Aucune ligne n’augmente pour ce foyer. '}
      {worst
        ? `La plus forte baisse vient de « ${worst.label} » (${formatEuroDelta(worst.shown)}).`
        : 'Aucune ligne ne baisse pour ce foyer.'}
    </>
  );

  return (
    <ChartFrame
      headingLevel={2}
      title="Ce qui change, ligne par ligne"
      subtitle={`Du revenu disponible d’aujourd’hui à celui avec le plan — ${periodLabel.toLowerCase()}. Touchez une ligne pour voir le calcul.`}
      summary={summary}
      sources={SOURCES}
      csvFileName="cascade-avant-apres.csv"
      table={{
        caption: 'Écart de revenu disponible par ligne, en euros par mois',
        columns: [
          { key: 'label', label: 'Ligne' },
          {
            key: 'delta',
            label: 'Écart (€/mois)',
            numeric: true,
            format: (v) => formatEuroDelta(Number(v)),
          },
          { key: 'tier', label: 'Niveau de preuve' },
          { key: 'before', label: 'Calcul aujourd’hui' },
          { key: 'after', label: 'Calcul avec le plan' },
        ],
        rows: steps.map((s) => ({
          label: s.label,
          delta: s.shown,
          tier: TIER_META[s.tier].label,
          before: s.formulaBefore,
          after: s.formulaAfter,
        })),
      }}
      note="Les montants sont arrondis à 5 € près ; les écarts s’additionnent exactement au résultat. Les lignes hachurées sont annoncées par les auteurs sans texte de loi ; les lignes pointillées reposent sur une hypothèse du simulateur."
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <ul
            className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-2"
            aria-label="Légende"
          >
            <Key tier="law" />
            <Key tier="announced" />
            <Key tier="hypothesis" />
            <li className="flex items-center gap-1.5">
              <IconUp size={14} className="text-gain" /> hausse
              <IconDown size={14} className="ms-2 text-loss" /> baisse
            </li>
          </ul>
          {steps.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={allOpen}
              onClick={() => setOpen(allOpen ? new Set() : new Set(steps.map((s) => s.key)))}
            >
              {allOpen ? 'Tout replier' : 'Tout déplier'}
            </Button>
          )}
        </div>

        {/* axis: scale in € relative to today's income */}
        <div className={cn(GRID, 'items-end')} aria-hidden="true">
          <span className="hidden sm:block" />
          <div className="relative col-span-2 h-5 text-xs text-ink-3 sm:col-span-1 sm:col-start-2">
            {axis.map(({ t, left }) => (
              <span
                key={t}
                className="num absolute -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${left}%` }}
              >
                {t === 0 ? 'aujourd’hui' : formatEuroDelta(t)}
              </span>
            ))}
          </div>
        </div>

        <ol className="border-t border-rule">
          {steps.map((s, i) => {
            const row = bridge.rows[i]!;
            const box = barBox(bridge, row.from, row.to);
            const positive = s.shown >= 0;
            const isOpen = open.has(s.key);
            const panel = `${uid}-${i}`;
            return (
              <li key={s.key} className="border-b border-rule">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panel}
                  onClick={() => toggle(s.key)}
                  className={cn(
                    GRID,
                    'w-full cursor-pointer items-center rounded-sm py-3 text-start hover:bg-sunken/60',
                  )}
                >
                  <span className="col-start-1 row-start-1 min-w-0 text-[0.9375rem] font-medium text-ink">
                    {s.label}
                    {s.tier !== 'law' && (
                      <TierBadge tier={s.tier} short size="sm" className="ms-2 align-middle" />
                    )}
                  </span>
                  <Track
                    axis={axis}
                    zero={zero}
                    className="col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1"
                  >
                    <span
                      className="absolute top-1/2 h-4 -translate-y-1/2 rounded-[4px]"
                      style={{
                        left: `${box.left}%`,
                        width: `${box.width}%`,
                        ...barStyle(s.tier, positive),
                      }}
                    />
                  </Track>
                  <span className="col-start-2 row-start-1 flex items-center justify-end gap-2 sm:col-start-3">
                    <span
                      className={cn(
                        'num inline-flex items-center gap-1 text-base font-bold',
                        s.shown === 0 ? 'text-ink-3' : positive ? 'text-gain' : 'text-loss',
                      )}
                    >
                      {s.shown !== 0 &&
                        (positive ? (
                          <IconUp size={14} strokeWidth={2} />
                        ) : (
                          <IconDown size={14} strokeWidth={2} />
                        ))}
                      {formatEuroDelta(s.shown)}
                    </span>
                    <IconChevron
                      size={18}
                      className={cn(
                        'shrink-0 text-ink-3 transition-transform',
                        isOpen && 'rotate-180',
                      )}
                    />
                  </span>
                </button>
                <div
                  id={panel}
                  hidden={!isOpen}
                  className="mb-3 space-y-3 rounded-md bg-sunken/60 p-4 text-sm text-ink-2 sm:ms-0"
                >
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                        Aujourd’hui
                      </dt>
                      <dd className="mt-0.5 text-ink">{s.formulaBefore}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                        Avec le plan
                      </dt>
                      <dd className="mt-0.5 text-ink">{s.formulaAfter}</dd>
                    </div>
                  </dl>
                  <div className="flex flex-wrap items-center gap-2">
                    <TierBadge tier={s.tier} size="sm" />
                    {s.sources.map((src, i) => (
                      <SourceChip key={i} label={src.label} href={src.url} />
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
          {steps.length === 0 && (
            <li className="py-6 text-[0.9375rem] text-ink-2">
              Pour ce foyer, aucune ligne ne change : le plan donne le même revenu disponible
              qu’aujourd’hui.
            </li>
          )}
          <li className={cn(GRID, 'items-center py-4')}>
            <span className="col-start-1 row-start-1 font-serif text-lg font-medium text-ink">
              Avec le plan
            </span>
            <Track
              axis={axis}
              zero={zero}
              className="col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1"
            >
              <span
                className="absolute top-1/2 h-4 -translate-y-1/2 rounded-[4px] bg-accent"
                style={{
                  left: `${barBox(bridge, 0, bridge.total).left}%`,
                  width: `${barBox(bridge, 0, bridge.total).width}%`,
                }}
              />
            </Track>
            <span className="num col-start-2 row-start-1 text-end font-serif text-xl font-medium text-ink sm:col-start-3">
              {formatEuro(fig.plan)}
            </span>
          </li>
        </ol>
        <p className="text-sm text-ink-2">
          <span className="font-semibold text-ink">Aujourd’hui :</span> {formatEuro(fig.baseline)}{' '}
          par mois. <span className="font-semibold text-ink">Avec le plan :</span>{' '}
          {formatEuro(fig.plan)} par mois, soit{' '}
          <span
            className={cn(
              'font-semibold',
              fig.delta > 0 ? 'text-gain' : fig.delta < 0 ? 'text-loss' : 'text-ink',
            )}
          >
            {formatEuroDelta(fig.delta)}
          </span>
          .
        </p>
      </div>
    </ChartFrame>
  );
}

function Track({
  axis,
  zero,
  className,
  children,
}: {
  axis: Array<{ t: number; left: number }>;
  zero: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span aria-hidden="true" className={cn('relative block h-7', className)}>
      {axis
        .filter((a) => a.t !== 0)
        .map((a) => (
          <span
            key={a.t}
            className="absolute inset-y-0 w-px bg-[var(--chart-grid)]"
            style={{ left: `${a.left}%` }}
          />
        ))}
      <span
        className="absolute inset-y-0 w-px bg-[var(--chart-axis)]"
        style={{ left: `${zero}%` }}
      />
      {children}
    </span>
  );
}

function Key({ tier }: { tier: Tier }) {
  const swatch: CSSProperties =
    tier === 'law'
      ? { backgroundColor: 'var(--ink-2)' }
      : tier === 'announced'
        ? {
            backgroundImage:
              'repeating-linear-gradient(135deg, var(--ink-2) 0 2px, transparent 2px 6px)',
            border: '1.5px dashed var(--ink-2)',
          }
        : {
            backgroundColor: 'color-mix(in oklab, var(--ink-2) 38%, transparent)',
            border: '2px dotted var(--ink-2)',
          };
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden="true" className="inline-block h-3 w-6 rounded-[3px]" style={swatch} />
      {TIER_META[tier].label}
    </li>
  );
}
