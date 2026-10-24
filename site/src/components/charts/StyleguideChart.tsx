import * as Plot from '@observablehq/plot';
import { useCallback, useMemo } from 'react';
import { ChartFrame } from '@/components/ui';
import { css, fr, hatchFill } from '@/lib/chart-theme';
import type { Column } from '@/lib/csv';
import { formatEuroDelta } from '@/lib/format';
import { TIER_META } from '@/lib/tiers';
import { PlotFigure } from './PlotFigure';

/** ILLUSTRATIVE data only — demonstrates the chart style, not a result of the plan. */
const LAW = TIER_META.law.label;
const PROMISED = TIER_META.announced.label;
type Row = { label: string; delta: number; tier: string };
const rows: Row[] = [
  { label: 'Salarié·e seul·e au SMIC', delta: 212, tier: LAW },
  { label: 'Couple, deux salaires, 2 enfants', delta: 148, tier: LAW },
  { label: 'Retraité·e, pension moyenne', delta: 35, tier: LAW },
  { label: 'Parent isolé, 1 enfant, locataire', delta: -85, tier: LAW },
  { label: 'Étudiant·e, aide au logement', delta: -40, tier: LAW },
  { label: 'Épargne retraite annoncée (CEP)', delta: 300, tier: PROMISED },
];
const columns: Column<Row>[] = [
  { key: 'label', label: 'Foyer type (fictif)' },
  {
    key: 'delta',
    label: 'Écart, €/mois',
    numeric: true,
    format: (v) => formatEuroDelta(Number(v)),
  },
  { key: 'tier', label: 'Niveau de preuve' },
];

const law = rows.filter((r) => r.tier === LAW);
const announced = rows.filter((r) => r.tier !== LAW);
const gains = law.filter((r) => r.delta >= 0);
const losses = law.filter((r) => r.delta < 0);

export default function StyleguideChart() {
  // « Annoncé » = hatched fill + dashed outline in the accent: added after render (patterns live in the SVG).
  const onRender = useCallback((el: SVGSVGElement | HTMLElement) => {
    const fill = hatchFill(el, 'plan', css.accent);
    el.querySelectorAll<SVGElement>('.epjn-announced rect').forEach((n) => {
      n.setAttribute('fill', fill);
      n.setAttribute('stroke', css.accent);
      n.setAttribute('stroke-width', '1.5');
      n.setAttribute('stroke-dasharray', '4 3');
    });
  }, []);

  const options = useMemo(
    () =>
      (width: number): Plot.PlotOptions => {
        const bar = { y: 'label', x: 'delta', rx: 3 } as const;
        const value = (d: Row) => formatEuroDelta(d.delta);
        const valueStyle = {
          y: 'label',
          x: 'delta',
          text: value,
          fill: css.ink,
          fontSize: 12,
          fontWeight: 600,
          fontVariant: 'tabular-nums',
        } as const;
        return {
          marginLeft: 12,
          marginRight: width < 480 ? 60 : 76,
          marginTop: 8,
          marginBottom: 32,
          height: rows.length * 60 + 40,
          // pad the domain so negative value labels never leave the frame
          x: {
            grid: true,
            tickFormat: fr.euro,
            label: null,
            ticks: width < 480 ? 4 : 6,
            domain: [-160, 360],
          },
          y: { axis: null, padding: 0.63, domain: rows.map((r) => r.label) },
          marks: [
            Plot.ruleX([0], { stroke: css.axis }),
            Plot.barX(gains, { ...bar, fill: css.gain }),
            Plot.barX(losses, { ...bar, fill: css.loss }),
            Plot.barX(announced, { ...bar, fill: css.accent, className: 'epjn-announced' }),
            // row labels sit above their bar, left-aligned in the frame: never clipped on a phone
            Plot.text(rows, {
              y: 'label',
              text: 'label',
              frameAnchor: 'left',
              textAnchor: 'start',
              dy: -27,
              fill: css.ink,
              fontSize: 13,
              fontWeight: 600,
            }),
            // values at the bar end: selective direct labels with an explicit sign
            Plot.text([...gains, ...announced], { ...valueStyle, textAnchor: 'start', dx: 6 }),
            Plot.text(losses, { ...valueStyle, textAnchor: 'end', dx: -6 }),
          ],
        };
      },
    [],
  );

  return (
    <ChartFrame
      title="Écart de revenu disponible par foyer type (exemple fictif)"
      subtitle="Euros par mois, régime de croisière — données d’illustration"
      summary="Dans cet exemple, trois foyers types sur cinq gagnent entre 35 € et 212 € par mois ; deux perdent, 40 € et 85 € par mois. La barre hachurée est une promesse annoncée, sans texte de loi, montrée à part."
      sources={[
        { label: 'Données fictives pour le guide de style', tier: 'hypothesis' },
        { label: 'Fiche des auteurs (exemple)', tier: 'announced' },
      ]}
      table={{
        columns,
        rows,
        caption: 'Écart de revenu disponible par foyer type (exemple fictif)',
      }}
      csvFileName="exemple-ecart-par-foyer.csv"
      note="Gain : bleu-vert et signe +. Perte : orange-vermillon et signe −. Annoncé : hachuré, contour pointillé. La couleur n’est jamais le seul signal."
    >
      <PlotFigure
        options={options}
        label="Barres horizontales : écart de revenu disponible par foyer type"
        onRender={onRender}
      />
    </ChartFrame>
  );
}
