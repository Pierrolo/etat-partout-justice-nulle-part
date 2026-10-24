import { useMemo, useState, type CSSProperties } from 'react';
import { ChartFrame, SegmentedControl } from '@/components/ui';
import { IconUp, IconDown } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { hourOfWork } from '@/lib/engine';
import type { Household, HourSplit, Hypotheses } from '@/lib/engine-types';
import { formatEuro, formatEuroDelta } from '@/lib/format';
import { withBase } from '@/lib/site';
import { useWidth } from './useWidth';

const SOURCES = [
  { label: 'Moteur de calcul du simulateur' },
  {
    label: 'Hypothèses H2 et H5',
    tier: 'hypothesis' as const,
    href: withBase('/methode/#registre'),
  },
];

type PartId =
  'youKeep' | 'impotRevenu' | 'tva' | 'csgCrds' | 'cotisationsSalariales' | 'cotisationsPatronales';

interface Part {
  id: PartId;
  label: string;
  /** Background of the segment (a CSS colour that follows the theme). */
  fill: string;
  /** Text colour on that fill. */
  ink: string;
}

/**
 * Greys for « what leaves the pay slip »: a mix of the ink and the card surface, in sRGB. Every level is
 * ≥ 3 : 1 against the card in both themes (graphical marks, WCAG 1.4.11). Its text colour is a token of
 * the brand (`--on-tint-<pct>`: pure black or white, whichever contrasts more, ≥ 4.5 : 1 — computed for
 * each brand's ink and card by chart-theme.test.ts), so it follows the brand with no script.
 */
function tint(pct: 90 | 78 | 66 | 56 | 48): Pick<Part, 'fill' | 'ink'> {
  return {
    fill: `color-mix(in srgb, var(--ink) ${pct}%, var(--surface))`,
    ink: `var(--on-tint-${pct})`,
  };
}

/** « Vous gardez » first (the baseline of the bar), then what leaves the pay slip, darkest first. */
const PARTS: Part[] = [
  {
    id: 'youKeep',
    label: 'Vous gardez',
    fill: 'var(--series-1)',
    ink: 'var(--on-hour-keep)',
  },
  { id: 'impotRevenu', label: 'Impôt sur le revenu', ...tint(90) },
  { id: 'tva', label: 'TVA', ...tint(78) },
  { id: 'csgCrds', label: 'CSG et CRDS', ...tint(66) },
  { id: 'cotisationsSalariales', label: 'Cotisations salariales', ...tint(56) },
  { id: 'cotisationsPatronales', label: 'Cotisations patronales', ...tint(48) },
];

const euro2 = (v: number) => formatEuro(v, { decimals: 2 });
const delta2 = (v: number) => formatEuroDelta(v, { decimals: 2 });

export interface HourOfWorkProps {
  household: Household;
  hypotheses: Hypotheses;
  /** The household headline (€/month, after TVA), so the page can tie this view back to it. */
  headlineText: string;
}

/**
 * « Votre heure de travail » — one hour of labour cost, split into what you keep and what goes to each
 * levy, today vs with the plan, both bars on the same scale. Since the engine v1.1 the figures include the
 * adult's own aide universelle (`youKeepIncludingTransfers`, `netIncomeTaxPerHour`), so this view cannot
 * contradict the household headline: « vous gardez moins par heure » is never shown next to a gain
 * that comes from the aide universelle.
 */
export function HourOfWork({ household, hypotheses, headlineText }: HourOfWorkProps) {
  const salaried = household.adults
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.activity === 'salarie' && a.salary && a.salary.status !== 'tns')
    .map(({ i }) => i);
  const [pick, setPick] = useState<number>(salaried[0] ?? 0);
  const who = salaried.includes(pick) ? pick : (salaried[0] ?? 0);

  const data = useMemo(
    () => (salaried.length ? hourOfWork(household, who, { hypotheses }) : null),
    [household, hypotheses, who, salaried.length],
  );

  if (!data) return null;
  const { baseline: b, plan: p, hoursPerMonth } = data;
  const keepB = b.youKeepIncludingTransfers;
  const keepP = p.youKeepIncludingTransfers;
  const gain = keepP - keepB;
  const dir = gain > 0.004 ? 'gain' : gain < -0.004 ? 'loss' : 'flat';
  const cost = Math.max(b.employerCostPerHour, p.employerCostPerHour);
  const afuMonthly = p.afuPerHour * hoursPerMonth;
  const stateGives = p.netIncomeTaxPerHour < -0.004;

  const summary = (
    <>
      Une heure de travail coûte {euro2(b.employerCostPerHour)} à l’employeur. Aujourd’hui, vous en
      gardez {euro2(keepB)} ; avec le plan, {euro2(keepP)} une fois l’aide universelle comptée (
      {delta2(gain)} par heure).{' '}
      {stateGives
        ? `L’impôt net de chaque heure devient négatif : l’État vous verse ${euro2(-p.netIncomeTaxPerHour)} par heure travaillée.`
        : `L’impôt net de chaque heure est de ${euro2(p.netIncomeTaxPerHour)}.`}{' '}
      Le reste va à l’impôt sur le revenu, à la TVA, à la CSG et à la CRDS, et aux cotisations.
    </>
  );

  return (
    <ChartFrame
      headingLevel={4}
      title="Où va l’argent d’une heure de votre travail"
      subtitle="Ce que vous gardez de chaque heure, aujourd’hui et avec le plan."
      summary={summary}
      sources={SOURCES}
      csvFileName="votre-heure-de-travail.csv"
      table={{
        caption: 'Répartition d’une heure de travail, en euros, aujourd’hui et avec le plan',
        columns: [
          { key: 'part', label: 'Part' },
          {
            key: 'today',
            label: 'Aujourd’hui (€/h)',
            numeric: true,
            format: (v) => euro2(Number(v)),
          },
          {
            key: 'plan',
            label: 'Avec le plan (€/h)',
            numeric: true,
            format: (v) => euro2(Number(v)),
          },
          { key: 'diff', label: 'Écart (€/h)', numeric: true, format: (v) => delta2(Number(v)) },
        ],
        rows: [
          {
            part: 'Coût total pour l’employeur',
            today: b.employerCostPerHour,
            plan: p.employerCostPerHour,
            diff: p.employerCostPerHour - b.employerCostPerHour,
          },
          ...PARTS.map((x) => ({
            part: x.label,
            today: b[x.id],
            plan: p[x.id],
            diff: p[x.id] - b[x.id],
          })),
          {
            part: 'Aide universelle reçue (par heure)',
            today: b.afuPerHour,
            plan: p.afuPerHour,
            diff: p.afuPerHour - b.afuPerHour,
          },
          {
            part: 'Impôt net par heure (impôt moins aide universelle)',
            today: b.netIncomeTaxPerHour,
            plan: p.netIncomeTaxPerHour,
            diff: p.netIncomeTaxPerHour - b.netIncomeTaxPerHour,
          },
          {
            part: 'Vous gardez, aide universelle comprise',
            today: keepB,
            plan: keepP,
            diff: gain,
          },
        ],
      }}
      note="Cette vue ne concerne que le salaire d’une personne. Les aides du foyer (prime d’activité, aides au logement…), l’aide universelle des enfants et la TVA ne sont pas rapportées à ses heures : elles comptent dans le résultat du foyer, plus haut."
    >
      <div className="space-y-6">
        {salaried.length > 1 && (
          <SegmentedControl
            legend="Pour qui ?"
            size="sm"
            options={salaried.map((i) => ({
              value: String(i),
              label: i === 0 ? 'Vous' : 'Votre conjoint·e',
            }))}
            value={String(who)}
            onChange={(v) => setPick(Number(v))}
          />
        )}

        <p data-testid="hour-sentence" className="text-[1.0625rem] leading-relaxed text-ink">
          Chaque heure de travail vous laissait <strong>{euro2(keepB)}</strong> ; avec le plan, elle
          vous laisse <strong>{euro2(keepP)}</strong>, parce que l’aide universelle (
          {formatEuro(afuMonthly)} par mois, versée à chaque adulte quel que soit son salaire) est
          répartie sur vos heures de travail
          {stateGives ? ' et dépasse même votre impôt' : ''}. {headlineText}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <KeepFigure caption="Aujourd’hui, vous gardez" value={euro2(keepB)} />
          <KeepFigure
            caption="Avec le plan, vous gardez"
            value={euro2(keepP)}
            accent
            foot={`Dont ${euro2(p.afuPerHour)} d’aide universelle par heure.`}
            extra={
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-sm font-bold',
                  dir === 'gain' ? 'text-gain' : dir === 'loss' ? 'text-loss' : 'text-ink-2',
                )}
              >
                {dir === 'gain' && <IconUp size={14} strokeWidth={2} />}
                {dir === 'loss' && <IconDown size={14} strokeWidth={2} />}
                {dir === 'flat' ? 'Pas de changement' : `${delta2(gain)} par heure`}
              </span>
            }
          />
        </div>

        <p className="text-[0.9375rem] text-ink-2">
          Pour une heure de travail, votre employeur paie{' '}
          <strong className="num text-ink">{euro2(cost)}</strong>, avant comme après le plan. Voici
          où va cet argent (l’aide universelle, versée à part, n’est pas dans ces barres).
        </p>

        <div className="space-y-5">
          <HourBar title="Aujourd’hui" split={b} scale={cost} />
          <HourBar title="Avec le plan" split={p} scale={cost} accent />
        </div>

        <ul aria-label="Légende" className="grid gap-x-8 sm:grid-cols-2">
          {PARTS.map((x) => {
            const d = p[x.id] - b[x.id];
            const flat = Math.abs(d) < 0.005;
            return (
              <li
                key={x.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 border-b border-rule py-2.5 text-sm"
              >
                <span
                  aria-hidden="true"
                  className="size-4 shrink-0 translate-y-0.5 self-start rounded-[4px] border border-[color-mix(in_srgb,var(--ink)_35%,transparent)]"
                  style={{ background: x.fill }}
                />
                <span className="min-w-0 font-semibold text-ink">{x.label}</span>
                <span
                  className={cn(
                    'num text-end font-bold',
                    flat
                      ? 'text-ink-3'
                      : x.id === 'youKeep'
                        ? d > 0
                          ? 'text-gain'
                          : 'text-loss'
                        : 'text-ink-2',
                  )}
                >
                  {flat ? 'inchangé' : delta2(d)}
                </span>
                <span className="col-span-2 col-start-2 row-start-2 text-ink-2">
                  <span className="num">{euro2(b[x.id])}</span> <span aria-hidden="true">→</span>
                  <span className="sr-only"> puis </span>{' '}
                  <span className="num">{euro2(p[x.id])}</span>
                </span>
              </li>
            );
          })}
        </ul>

        <dl className="grid gap-x-8 gap-y-2 rounded-md bg-sunken px-4 py-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-ink">Aide universelle reçue, par heure</dt>
            <dd className="num text-ink-2">
              {euro2(b.afuPerHour)} → {euro2(p.afuPerHour)}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Impôt net par heure (impôt moins aide)</dt>
            <dd className="num text-ink-2">
              {euro2(b.netIncomeTaxPerHour)} → {euro2(p.netIncomeTaxPerHour)}
              {stateGives ? ' (l’État vous verse)' : ''}
            </dd>
          </div>
        </dl>
      </div>
    </ChartFrame>
  );
}

function KeepFigure({
  caption,
  value,
  extra,
  foot,
  accent,
}: {
  caption: string;
  value: string;
  extra?: React.ReactNode;
  foot?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border-[1.5px] p-4',
        accent ? 'border-accent bg-accent-soft/50' : 'border-rule bg-sunken/50',
      )}
    >
      <p className="text-sm font-medium text-ink-2">{caption}</p>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="stat-number text-4xl text-ink">{value}</span>
        <span className="font-serif text-lg text-ink-2">par heure</span>
      </p>
      {extra && <p className="mt-1">{extra}</p>}
      {foot && <p className="mt-2 text-sm text-ink-2">{foot}</p>}
    </div>
  );
}

function HourBar({
  title,
  split,
  scale,
  accent,
}: {
  title: string;
  split: HourSplit;
  scale: number;
  accent?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const shown = PARTS.filter((x) => split[x.id] > 0.004);
  const GAP = 2;
  const usable = Math.max(0, width - GAP * (shown.length - 1));
  return (
    <div className="space-y-1.5">
      <p className="flex items-baseline justify-between gap-3 text-sm">
        <span className={cn('font-semibold', accent ? 'text-accent' : 'text-ink')}>{title}</span>
        <span className="num text-ink-3">{euro2(split.employerCostPerHour)} pour l’employeur</span>
      </p>
      <div
        ref={ref}
        role="img"
        aria-label={`${title} : ${shown.map((x) => `${x.label} ${euro2(split[x.id])}`).join(', ')}`}
      >
        <div className="flex h-14 sm:h-16" style={{ gap: GAP }}>
          {shown.map((x, i) => {
            const v = split[x.id];
            const w = (v / scale) * usable;
            const valueW = euro2(v).length * 7.6 + 14;
            const nameW = x.label.length * 6.6 + 16;
            const mode = w >= nameW && w >= valueW ? 'both' : w >= valueW ? 'value' : 'none';
            const style: CSSProperties = {
              flex: `${v} 1 0%`,
              minWidth: 0,
              background: x.fill,
              color: x.ink,
              border: '1px solid color-mix(in srgb, var(--ink) 30%, transparent)',
              borderStartStartRadius: i === 0 ? 8 : 0,
              borderEndStartRadius: i === 0 ? 8 : 0,
              borderStartEndRadius: i === shown.length - 1 ? 8 : 0,
              borderEndEndRadius: i === shown.length - 1 ? 8 : 0,
            };
            return (
              <div
                key={x.id}
                className="flex flex-col items-center justify-center text-center leading-tight"
                style={style}
              >
                {mode === 'both' && (
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-wide opacity-90">
                    {x.label}
                  </span>
                )}
                {mode !== 'none' && (
                  <span className="num text-[0.8125rem] font-bold sm:text-sm">{euro2(v)}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
