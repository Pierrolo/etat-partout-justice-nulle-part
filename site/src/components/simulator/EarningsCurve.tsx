import * as Plot from '@observablehq/plot';
import { useId, useMemo, useState } from 'react';
import { PlotFigure } from '@/components/charts/PlotFigure';
import { ChartFrame, Switch } from '@/components/ui';
import { ticks as d3ticks } from 'd3';
import { css, fr } from '@/lib/chart-theme';
import { earningsCurve } from '@/lib/engine';
import type { Comparison, EarningsPoint, Household, Hypotheses } from '@/lib/engine-types';

/** Curve points on the basis of the headline: after indirect taxes when they are counted. */
const view = (p: EarningsPoint, afterTva: boolean) => ({
  ...p,
  baseline: afterTva ? p.baselineAfterTva : p.baseline,
  plan: afterTva ? p.planAfterTva : p.plan,
});
import { formatEuro, formatEuroDelta, formatPercent, roundForDisplay } from '@/lib/format';
import { DISPLAY_STEP } from '@/lib/sim/result';

const SOURCES = [{ label: 'Moteur de calcul du simulateur', tier: 'law' as const }];

/** x axis shared by both charts: few, compact ticks on a phone so labels never collide. */
function xAxis(narrow: boolean, maxNet: number) {
  return {
    label: 'Salaire net mensuel d’aujourd’hui (€)',
    labelAnchor: 'center',
    labelArrow: 'none',
    tickFormat: narrow ? fr.compactEuro : fr.euro,
    ticks: d3ticks(0, maxNet, narrow ? 3 : 6),
    domain: [0, maxNet],
  };
}

function at(points: EarningsPoint[], x: number): EarningsPoint {
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (x <= first.netToday) return first;
  if (x >= last.netToday) return last;
  const i = points.findIndex((p) => p.netToday >= x);
  const b = points[i]!;
  const a = points[i - 1]!;
  const t = (x - a.netToday) / (b.netToday - a.netToday || 1);
  const out = { ...a, netToday: x } as Record<keyof EarningsPoint, number>;
  for (const k of Object.keys(a) as Array<keyof EarningsPoint>) {
    if (k !== 'netToday') out[k] = a[k] + (b[k] - a[k]) * t;
  }
  return out;
}

export interface EarningsCurveProps {
  household: Household;
  hypotheses: Hypotheses;
  comparison: Comparison;
}

/** « Si je gagnais plus ? » — disposable income against net salary, today vs plan, with your position. */
export function EarningsCurve({ household, hypotheses, comparison }: EarningsCurveProps) {
  const uid = useId();
  const [expert, setExpert] = useState(false);
  const [explore, setExplore] = useState<number | null>(null);
  // The engine turns the first adult into a salaried worker for the curve; a pension is not a salary.
  const salaried = household.adults[0].activity !== 'retraite';
  const userNet = comparison.baseline.perAdult[0]?.net ?? 0;

  const maxNet = useMemo(
    () => Math.min(12000, Math.max(5000, Math.ceil((userNet * 2) / 500) * 500)),
    [userNet],
  );
  const step = maxNet > 6000 ? 100 : 50;
  const afterTva = hypotheses.includeTva;
  const pts = useMemo(
    () =>
      salaried
        ? earningsCurve(household, { hypotheses, maxNet, step }).map((p) => view(p, afterTva))
        : [],
    [salaried, household, hypotheses, maxNet, step, afterTva],
  );

  const me = pts.length ? at(pts, userNet) : null;
  const probeX = explore ?? userNet;
  const probe = pts.length ? at(pts, probeX) : null;

  const options = useMemo(
    () => (width: number) => {
      const narrow = width < 480;
      const markers = [
        ...(me ? [{ ...me, who: 'Vous' }] : []),
        ...(explore !== null && probe ? [{ ...probe, who: 'Exploré' }] : []),
      ];
      const last = pts[pts.length - 1]!;
      return {
        height: narrow ? 300 : 380,
        marginLeft: narrow ? 54 : 68,
        marginRight: narrow ? 84 : 116,
        marginTop: 20,
        marginBottom: 46,
        x: xAxis(narrow, maxNet),
        y: {
          label: '↑ Revenu disponible du ménage (€/mois)',
          tickFormat: fr.euro,
          ticks: 5,
          grid: true,
        },
        marks: [
          Plot.line(pts, { x: 'netToday', y: 'baseline', stroke: css.ink3, strokeWidth: 2 }),
          Plot.line(pts, { x: 'netToday', y: 'plan', stroke: css.accent, strokeWidth: 3 }),
          Plot.ruleX(markers, { x: 'netToday', stroke: css.ink3, strokeOpacity: 0.55 }),
          Plot.dot(markers, {
            x: 'netToday',
            y: 'baseline',
            r: 5.5,
            fill: css.ink3,
            stroke: css.surface,
            strokeWidth: 2,
          }),
          Plot.dot(markers, {
            x: 'netToday',
            y: 'plan',
            r: 5.5,
            fill: css.accent,
            stroke: css.surface,
            strokeWidth: 2,
          }),
          Plot.text(markers, {
            x: 'netToday',
            text: 'who',
            frameAnchor: 'bottom',
            dy: -6,
            fill: css.ink,
            fontWeight: 700,
            fontSize: 12,
            stroke: css.surface,
            strokeWidth: 4,
            paintOrder: 'stroke',
          }),
          Plot.text([last], {
            x: 'netToday',
            y: 'plan',
            text: () => 'Avec le plan',
            textAnchor: 'start',
            dx: 8,
            fill: css.ink,
            fontWeight: 700,
          }),
          Plot.text([last], {
            x: 'netToday',
            y: 'baseline',
            text: () => 'Aujourd’hui',
            textAnchor: 'start',
            dx: 8,
            fill: css.ink2,
            fontWeight: 600,
          }),
          Plot.tip(
            pts,
            Plot.pointerX({
              x: 'netToday',
              y: 'plan',
              title: (d: EarningsPoint) =>
                `Salaire net ${formatEuro(d.netToday)}\nAujourd’hui : ${formatEuro(roundForDisplay(d.baseline, DISPLAY_STEP))}\nAvec le plan : ${formatEuro(roundForDisplay(d.plan, DISPLAY_STEP))}`,
            }),
          ),
        ],
      } as Plot.PlotOptions;
    },
    [pts, me, probe, explore, maxNet],
  );

  const mtrOptions = useMemo(
    () => (width: number) => {
      const narrow = width < 480;
      const last = pts[pts.length - 1]!;
      return {
        height: narrow ? 260 : 320,
        marginLeft: narrow ? 48 : 60,
        marginRight: narrow ? 88 : 116,
        marginTop: 20,
        marginBottom: 46,
        x: xAxis(narrow, maxNet),
        y: {
          label: '↑ Part de chaque euro en plus qui disparaît',
          tickFormat: (d: number) => fr.percent(d),
          domain: [0, 1],
          ticks: 5,
          grid: true,
        },
        marks: [
          Plot.line(pts, { x: 'netToday', y: 'mtrBaseline', stroke: css.ink3, strokeWidth: 2 }),
          Plot.line(pts, { x: 'netToday', y: 'mtrPlan', stroke: css.accent, strokeWidth: 3 }),
          Plot.ruleX([userNet], { stroke: css.ink3, strokeOpacity: 0.55 }),
          Plot.text([last], {
            x: 'netToday',
            y: 'mtrPlan',
            text: () => 'Avec le plan',
            textAnchor: 'start',
            dx: 8,
            fill: css.ink,
            fontWeight: 700,
          }),
          Plot.text([last], {
            x: 'netToday',
            y: 'mtrBaseline',
            text: () => 'Aujourd’hui',
            textAnchor: 'start',
            dx: 8,
            dy: -8,
            fill: css.ink2,
            fontWeight: 600,
          }),
          Plot.tip(
            pts,
            Plot.pointerX({
              x: 'netToday',
              y: 'mtrPlan',
              title: (d: EarningsPoint) =>
                `Salaire net ${formatEuro(d.netToday)}\nAujourd’hui : ${formatPercent(d.mtrBaseline)}\nAvec le plan : ${formatPercent(d.mtrPlan)}`,
            }),
          ),
        ],
      } as Plot.PlotOptions;
    },
    [pts, userNet, maxNet],
  );

  if (!salaried) {
    return (
      <section aria-labelledby="curve-title" className="card space-y-2">
        <h2 id="curve-title" className="font-serif text-xl font-medium text-ink sm:text-2xl">
          Si je gagnais plus ?
        </h2>
        <p className="text-[0.9375rem] text-ink-2">
          Cette courbe montre l’effet d’un salaire plus élevé. Elle n’est pas proposée quand la
          première personne du foyer est retraitée : une pension n’est pas un salaire.
        </p>
      </section>
    );
  }

  const tableRows = pts
    .filter((p) => p.netToday % 250 === 0)
    .map((p) => ({
      net: p.netToday,
      base: roundForDisplay(p.baseline, DISPLAY_STEP),
      plan: roundForDisplay(p.plan, DISPLAY_STEP),
      mtrB: p.mtrBaseline,
      mtrP: p.mtrPlan,
    }));
  const maxMtrB = pts.reduce((m, p) => (p.mtrBaseline > m.mtrBaseline ? p : m), pts[0]!);
  const maxMtrP = pts.reduce((m, p) => (p.mtrPlan > m.mtrPlan ? p : m), pts[0]!);
  const gap = me ? roundForDisplay(me.plan - me.baseline, DISPLAY_STEP) : 0;

  const summary = (
    <>
      Avec un salaire net de {formatEuro(userNet)} par mois, votre revenu disponible est de{' '}
      {formatEuro(roundForDisplay(me!.baseline, DISPLAY_STEP))} aujourd’hui et de{' '}
      {formatEuro(roundForDisplay(me!.plan, DISPLAY_STEP))} avec le plan ({formatEuroDelta(gap)}).
      Les deux courbes montrent ce que devient ce revenu si votre salaire net change ; leur écart
      indique où le plan aide le plus, et où il aide moins.
    </>
  );

  const rangeId = `${uid}-range`;
  const readout = probe && (
    <p className="rounded-md bg-sunken px-3.5 py-2.5 text-[0.9375rem] text-ink" aria-live="polite">
      À <span className="num font-bold">{formatEuro(probe.netToday)}</span> net par mois, le revenu
      disponible est de{' '}
      <span className="num font-bold">
        {formatEuro(roundForDisplay(probe.baseline, DISPLAY_STEP))}
      </span>{' '}
      aujourd’hui et de{' '}
      <span className="num font-bold text-accent">
        {formatEuro(roundForDisplay(probe.plan, DISPLAY_STEP))}
      </span>{' '}
      avec le plan (
      <span className="num font-bold">
        {formatEuroDelta(roundForDisplay(probe.plan - probe.baseline, DISPLAY_STEP))}
      </span>
      ).
    </p>
  );

  return (
    <div className="space-y-4">
      <ChartFrame
        headingLevel={2}
        title="Si je gagnais plus ?"
        subtitle="Revenu disponible du ménage selon le salaire net du premier adulte, aujourd’hui et avec le plan complet."
        summary={summary}
        sources={SOURCES}
        csvFileName="si-je-gagnais-plus.csv"
        table={{
          caption: 'Revenu disponible selon le salaire net mensuel, aujourd’hui et avec le plan',
          columns: [
            {
              key: 'net',
              label: 'Salaire net (€/mois)',
              numeric: true,
              format: (v) => formatEuro(Number(v)),
            },
            {
              key: 'base',
              label: 'Aujourd’hui (€/mois)',
              numeric: true,
              format: (v) => formatEuro(Number(v)),
            },
            {
              key: 'plan',
              label: 'Avec le plan (€/mois)',
              numeric: true,
              format: (v) => formatEuro(Number(v)),
            },
            {
              key: 'mtrB',
              label: 'Taux marginal aujourd’hui',
              numeric: true,
              format: (v) => formatPercent(Number(v)),
            },
            {
              key: 'mtrP',
              label: 'Taux marginal avec le plan',
              numeric: true,
              format: (v) => formatPercent(Number(v)),
            },
          ],
          rows: tableRows,
        }}
        note="Seul le salaire du premier adulte varie ; le reste du foyer est inchangé. Euros de 2026, plan complet."
      >
        <div className="space-y-4">
          <ul
            className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-2"
            aria-label="Légende"
          >
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="inline-block h-0.5 w-7 bg-ink-3" /> Aujourd’hui
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="inline-block h-[3px] w-7 bg-accent" /> Avec le
              plan
            </li>
            <li className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block size-3 rounded-full border-2 border-surface bg-ink-3 ring-1 ring-ink-3"
              />{' '}
              Votre position
            </li>
          </ul>
          <PlotFigure
            options={options}
            label="Courbes du revenu disponible selon le salaire net, aujourd’hui et avec le plan"
            height={300}
          />
          <div className="space-y-2">
            <label htmlFor={rangeId} className="block text-[0.9375rem] font-semibold text-ink">
              Explorer un autre salaire net
            </label>
            <input
              id={rangeId}
              type="range"
              min={0}
              max={maxNet}
              step={step}
              value={explore ?? Math.round(userNet / step) * step}
              onChange={(e) => setExplore(Number(e.target.value))}
              className="block w-full accent-[var(--accent)]"
              aria-describedby={`${rangeId}-out`}
            />
            <div id={`${rangeId}-out`}>{readout}</div>
          </div>
          <div className="border-t border-rule pt-2">
            <Switch
              label="Mode expert : taux marginal d’imposition effectif"
              hint="Sur un euro gagné en plus, quelle part s’en va en impôts, cotisations et aides perdues ?"
              checked={expert}
              onChange={setExpert}
              stateLabels={['Affiché', 'Masqué']}
            />
          </div>
        </div>
      </ChartFrame>

      {expert && (
        <ChartFrame
          headingLevel={3}
          title="Sur un euro gagné en plus, combien reste-t-il ?"
          subtitle="Part de chaque euro de salaire net supplémentaire qui disparaît (impôt, cotisations, aides perdues)."
          summary={
            <>
              Aujourd’hui, ce taux monte jusqu’à {formatPercent(maxMtrB.mtrBaseline)} autour de{' '}
              {formatEuro(maxMtrB.netToday)} net par mois. Avec le plan, il ne dépasse pas{' '}
              {formatPercent(maxMtrP.mtrPlan)}, autour de {formatEuro(maxMtrP.netToday)} net.
            </>
          }
          sources={SOURCES}
          note="Calculé par différence finie sur de petits pas de salaire. Les pics d’aujourd’hui viennent de la perte progressive des aides ; le tableau ci-dessus donne les mêmes valeurs en chiffres."
        >
          <PlotFigure
            options={mtrOptions}
            label="Courbes du taux marginal d’imposition effectif selon le salaire net"
            height={260}
          />
        </ChartFrame>
      )}
    </div>
  );
}
