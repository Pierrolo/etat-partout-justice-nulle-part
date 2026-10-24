import { useMemo, useState, type CSSProperties } from 'react';
import { ChartFrame, SegmentedControl } from '@/components/ui';
import { IconUp, IconDown } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { contrastRatio } from '@/lib/contrast';
import { hourOfWork } from '@/lib/engine';
import type { Household, HourSplit, Hypotheses } from '@/lib/engine-types';
import { formatEuro, formatEuroDelta } from '@/lib/format';
import { useWidth } from './useWidth';

const SOURCES = [
  { label: 'Moteur de calcul du simulateur', tier: 'law' as const },
  { label: 'Hypothèses H2 et H5', tier: 'hypothesis' as const },
];

type PartId = keyof Omit<HourSplit, 'employerCostPerHour'>;

interface Part {
  id: PartId;
  label: string;
  /** Background of the segment (a CSS colour that follows the theme). */
  fill: string;
  /** Text colour on that fill. */
  ink: string;
}

/**
 * Greys for « what leaves the pay slip »: a mix of the ink and the card surface, in sRGB (CSS and this
 * code mix the same way). Every level is ≥ 3 : 1 against the card in both themes (graphical marks, WCAG
 * 1.4.11), and its text is pure black or white, whichever contrasts more (≥ 4.5 : 1, worst case 4.58).
 */
const THEME = {
  ink: { light: '#15171c', dark: '#edece7' },
  surface: { light: '#ffffff', dark: '#1c1d24' },
} as const;

function mixHex(a: string, b: string, pctA: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const m = (i: number) => Math.round((ch(a, i) * pctA + ch(b, i) * (100 - pctA)) / 100);
  return `#${[0, 1, 2].map((i) => m(i).toString(16).padStart(2, '0')).join('')}`;
}
const bestText = (bg: string) =>
  contrastRatio(bg, '#ffffff') >= contrastRatio(bg, '#000000') ? '#ffffff' : '#000000';

function tint(pct: number): Pick<Part, 'fill' | 'ink'> {
  const bgL = mixHex(THEME.ink.light, THEME.surface.light, pct);
  const bgD = mixHex(THEME.ink.dark, THEME.surface.dark, pct);
  return {
    fill: `color-mix(in srgb, var(--ink) ${pct}%, var(--surface))`,
    ink: `light-dark(${bestText(bgL)}, ${bestText(bgD)})`,
  };
}

/** « Vous gardez » first (the baseline of the bar), then what leaves the pay slip, darkest first. */
const PARTS: Part[] = [
  {
    id: 'youKeep',
    label: 'Vous gardez',
    fill: 'var(--series-1)',
    ink: 'light-dark(#ffffff, #0c1424)',
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
  /** Monthly benefits (today) and benefits + AFU (plan), which live outside the pay slip. */
  transfers: { baseline: number; plan: number };
}

/**
 * « Votre heure de travail » — the signature visual. One hour of labour cost, split into what you keep
 * and what goes to each levy, today vs with the plan, both bars on the same scale.
 */
export function HourOfWork({ household, hypotheses, transfers }: HourOfWorkProps) {
  const salaried = household.adults
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.activity === 'salarie')
    .map(({ i }) => i);
  const [pick, setPick] = useState<number>(salaried[0] ?? 0);
  const who = salaried.includes(pick) ? pick : (salaried[0] ?? 0);

  const data = useMemo(
    () => (salaried.length ? hourOfWork(household, who, { hypotheses }) : null),
    [household, hypotheses, who, salaried.length],
  );

  if (!data) return null;
  const { baseline: b, plan: p } = data;
  const gain = p.youKeep - b.youKeep;
  const dir = gain > 0.004 ? 'gain' : gain < -0.004 ? 'loss' : 'flat';
  const cost = Math.max(b.employerCostPerHour, p.employerCostPerHour);

  const summary = (
    <>
      Une heure de travail coûte {euro2(b.employerCostPerHour)} à l’employeur. Aujourd’hui, vous en
      gardez {euro2(b.youKeep)} ; avec le plan, {euro2(p.youKeep)} ({delta2(gain)} par heure). Le
      reste va à l’impôt sur le revenu, à la TVA, à la CSG et à la CRDS, et aux cotisations.
    </>
  );

  return (
    <ChartFrame
      headingLevel={2}
      title="Votre heure de travail"
      subtitle="Où va chaque euro payé par votre employeur pour une heure de votre travail, aujourd’hui et avec le plan."
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
        ],
      }}
      note="Cette vue concerne une personne salariée. Les aides et l’allocation fondamentale (AFU) sont versées à part : elles n’entrent pas dans une heure de travail, d’où les montants rappelés en dessous des deux chiffres. Dans le plan, l’impôt est celui de 23 % avant AFU."
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

        <div className="grid gap-4 sm:grid-cols-2">
          <KeepFigure
            caption="Aujourd’hui, vous gardez"
            value={euro2(b.youKeep)}
            foot={
              transfers.baseline >= 5
                ? `En plus, hors de cette heure : ${formatEuro(Math.round(transfers.baseline / 5) * 5)} par mois d’aides pour le foyer.`
                : undefined
            }
          />
          <KeepFigure
            caption="Avec le plan, vous gardez"
            value={euro2(p.youKeep)}
            accent
            foot={
              transfers.plan >= 5
                ? `En plus, hors de cette heure : ${formatEuro(Math.round(transfers.plan / 5) * 5)} par mois d’allocation fondamentale (AFU) et d’aides pour le foyer.`
                : undefined
            }
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
          <strong className="num text-ink">{euro2(cost)}</strong>. Voici ce que devient cet argent.
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
                  className="size-4 shrink-0 translate-y-0.5 self-start rounded-[4px]"
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
