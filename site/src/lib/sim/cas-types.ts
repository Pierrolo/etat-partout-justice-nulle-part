/**
 * « Qui gagne, qui perd ? » — pure logic: income buckets, grouping by family, diverging colours.
 * Standard cases only: nothing here estimates a share of the population.
 */
import { rgb } from 'd3';
import { divergingInterpolator } from '@/lib/chart-theme';
import { contrastRatio } from '@/lib/contrast';
import type { CasType, Comparison, Hypotheses, Period } from '@/lib/engine-types';
import { formatEuro } from '@/lib/format';
import { displayFigures } from '@/lib/sim/result';

export interface IncomeBucket {
  id: string;
  /** Lower bound included, upper bound excluded (€/month, net). */
  min: number;
  max: number;
  label: string;
}

const EDGES = [0, 1500, 2500, 3500, 5000, 7000, Number.POSITIVE_INFINITY];

export const INCOME_BUCKETS: IncomeBucket[] = EDGES.slice(0, -1).map((min, i) => {
  const max = EDGES[i + 1]!;
  return {
    id: `b${i}`,
    min,
    max,
    label:
      i === 0
        ? `Moins de ${formatEuro(max)}`
        : Number.isFinite(max)
          ? `${formatEuro(min)} à ${formatEuro(max)}`
          : `${formatEuro(min)} ou plus`,
  };
});

export const bucketOf = (income: number): IncomeBucket =>
  INCOME_BUCKETS.find((b) => income >= b.min && income < b.max) ?? INCOME_BUCKETS[0]!;

/** Net monthly income before tax and benefits: salaries, pensions, unemployment benefit (« revenus »). */
export function householdIncome(c: Comparison): number {
  return c.baseline.components
    .filter((x) => x.group === 'revenus')
    .reduce((s, x) => s + x.amount, 0);
}

export interface CaseRow {
  id: string;
  label: string;
  family: string;
  income: number;
  bucket: string;
  baseline: number;
  plan: number;
  delta: number;
  pct: number;
  /** Largest single line, for the table's « principal effet » hint. */
  top: string;
  cas: CasType;
}

export function buildRows(
  cases: CasType[],
  compare: (h: CasType['household'], o: { period: Period; hypotheses: Hypotheses }) => Comparison,
  period: Period,
  hypotheses: Hypotheses,
): CaseRow[] {
  return cases.map((cas) => {
    const c = compare(cas.household, { period, hypotheses });
    const fig = displayFigures(c);
    const income = householdIncome(c);
    const biggest = c.waterfall.reduce<(typeof c.waterfall)[number] | null>(
      (b, w) => (!b || Math.abs(w.delta) > Math.abs(b.delta) ? w : b),
      null,
    );
    return {
      id: cas.id,
      label: cas.label,
      family: cas.family,
      income,
      bucket: bucketOf(income).id,
      baseline: fig.baseline,
      plan: fig.plan,
      delta: fig.delta,
      pct: fig.pct,
      top: biggest?.label ?? '—',
      cas,
    };
  });
}

/** Families in order of first appearance (the engine's order is the narrative order). */
export function families(rows: CaseRow[]): string[] {
  return [...new Set(rows.map((r) => r.family))];
}

/* ── Colour ─────────────────────────────────────────────────────────────── */

export interface TileColor {
  bgLight: string;
  bgDark: string;
  fgLight: string;
  fgDark: string;
}

/** Pure black / white: with these two the worst case (mid-tone fill) is still 4.58 : 1 (near-black gives 4.24). */
const INK = '#000000';
const WHITE = '#ffffff';

function best(bg: string): string {
  return contrastRatio(bg, WHITE) >= contrastRatio(bg, INK) ? WHITE : INK;
}

const light = divergingInterpolator('light');
const dark = divergingInterpolator('dark');

/** `t` in [−1, 1]: −1 strongest loss, 0 neutral, +1 strongest gain. Text is white or black, whichever contrasts more (≥ 4.5 : 1 everywhere). */
export function tileColor(t: number): TileColor {
  const bgLight = rgb(light(t)).formatHex();
  const bgDark = rgb(dark(t)).formatHex();
  return { bgLight, bgDark, fgLight: best(bgLight), fgDark: best(bgDark) };
}

export const tileStyle = (c: TileColor) => ({
  background: `light-dark(${c.bgLight}, ${c.bgDark})`,
  color: `light-dark(${c.fgLight}, ${c.fgDark})`,
});

export function stateHash(cas: CasType, hypotheses: Hypotheses, period: Period): string {
  return `${cas.id}|${period}|${JSON.stringify(hypotheses)}`;
}
