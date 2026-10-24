/**
 * « Qui gagne, qui perd ? » — pure logic: income buckets, grouping by family, diverging colours.
 * Standard cases only: nothing here estimates a share of the population.
 */
import { rgb } from 'd3';
import { divergingInterpolator } from '@/lib/chart-theme';
import { contrastRatio } from '@/lib/contrast';
import type {
  CasType,
  Comparison,
  DisplayComparison,
  Hypotheses,
  Period,
} from '@/lib/engine-types';
import { formatEuro, formatEuroDelta } from '@/lib/format';
import { headlinePct, pctText } from '@/lib/sim/result';
import { typo } from '@/lib/typo';

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
  /** Today's disposable income, after the estimated TVA, rounded for display (engine `roundForDisplay`). */
  baseline: number;
  plan: number;
  delta: number;
  /** Relative change, or `null` when today's income is almost nil (the engine's `deltaPct` is `null`): show « — ». */
  pct: number | null;
  /** Largest single line, for the table's « principal effet » hint. */
  top: string;
  cas: CasType;
}

export interface RowEngine {
  compare: (h: CasType['household'], o: { period: Period; hypotheses: Hypotheses }) => Comparison;
  roundForDisplay: (c: Comparison) => DisplayComparison;
}

export function buildRows(
  cases: CasType[],
  engine: RowEngine,
  period: Period,
  hypotheses: Hypotheses,
): CaseRow[] {
  return cases.map((cas) => {
    const c = engine.compare(cas.household, { period, hypotheses });
    const fig = engine.roundForDisplay(c);
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
      baseline: fig.baselineAfterTva,
      plan: fig.planAfterTva,
      delta: fig.deltaAfterTva,
      pct: headlinePct(c),
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
  /** Same four colours on the « Call Intelligence » ramp. */
  ci: { bgLight: string; bgDark: string; fgLight: string; fgDark: string };
}

/** Pure black / white: with these two the worst case (mid-tone fill) is still 4.58 : 1 (near-black gives 4.24). */
const INK = '#000000';
const WHITE = '#ffffff';

function best(bg: string): string {
  return contrastRatio(bg, WHITE) >= contrastRatio(bg, INK) ? WHITE : INK;
}

const light = divergingInterpolator('light');
const dark = divergingInterpolator('dark');
// « Call Intelligence » has its own diverging ramp; the page chooses between the two with CSS
// (brand-ci.css reads the --tile-*-ci properties), so the heat map is right on first paint.
const lightCi = divergingInterpolator('light', 'ci');
const darkCi = divergingInterpolator('dark', 'ci');

/** `t` in [−1, 1]: −1 strongest loss, 0 neutral, +1 strongest gain. Text is white or black, whichever contrasts more (≥ 4.5 : 1 everywhere). */
export function tileColor(t: number): TileColor {
  const bgLight = rgb(light(t)).formatHex();
  const bgDark = rgb(dark(t)).formatHex();
  const ci = {
    bgLight: rgb(lightCi(t)).formatHex(),
    bgDark: rgb(darkCi(t)).formatHex(),
    fgLight: '',
    fgDark: '',
  };
  ci.fgLight = best(ci.bgLight);
  ci.fgDark = best(ci.bgDark);
  return { bgLight, bgDark, fgLight: best(bgLight), fgDark: best(bgDark), ci };
}

export const tileStyle = (c: TileColor) => ({
  background: `light-dark(${c.bgLight}, ${c.bgDark})`,
  color: `light-dark(${c.fgLight}, ${c.fgDark})`,
  '--tile-bg-ci': `light-dark(${c.ci.bgLight}, ${c.ci.bgDark})`,
  '--tile-fg-ci': `light-dark(${c.ci.fgLight}, ${c.ci.fgDark})`,
});

/* ── The pattern, in words ──────────────────────────────────────────────── */

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const joinList = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} et ${xs[xs.length - 1]}`;
const uniq = (xs: string[]) => [...new Set(xs)];

/** Below this net monthly income, a household type counts as « modest » in the pattern sentence. */
export const MODEST_INCOME = 1500;

/**
 * « Ce que montrent ces cas types »: three plain sentences computed from the rows — who loses, what happens
 * at modest incomes, the two ends. No count of « n sur 47 » is ever a headline (they would be quoted as a
 * share of the population, which these standard cases are not).
 */
export function describePattern(rows: CaseRow[]): Array<{ key: string; text: string }> {
  if (rows.length === 0) return [];
  const out: Array<{ key: string; text: string }> = [];
  const losers = rows.filter((r) => r.delta < 0);
  out.push({
    key: 'loss',
    text:
      losers.length === 0
        ? 'Avec ces réglages, aucun des foyers types ne perd.'
        : `Les foyers types qui perdent se trouvent dans ces familles : ${joinList(uniq(losers.map((r) => lowerFirst(r.family))))}.`,
  });

  const modest = rows.filter((r) => r.income < MODEST_INCOME);
  if (modest.length > 0) {
    const mLosers = modest.filter((r) => r.delta < 0);
    const mWinners = modest.filter((r) => r.delta > 0);
    const where = `Sous ${formatEuro(MODEST_INCOME)} de revenu net par mois, `;
    const lossText =
      mLosers.length === 0
        ? 'aucun foyer type ne perd'
        : `les foyers types qui perdent sont : ${joinList(uniq(mLosers.map((r) => lowerFirst(r.family))))}`;
    const gainText =
      mWinners.length === 0
        ? ''
        : `, les autres gagnent de ${formatEuroDelta(Math.min(...mWinners.map((r) => r.delta)))} à ${formatEuroDelta(Math.max(...mWinners.map((r) => r.delta)))} par mois`;
    out.push({ key: 'modest', text: `${where}${lossText}${gainText}.` });
  }

  const best = rows.reduce((b, r) => (r.delta > b.delta ? r : b), rows[0]!);
  const worst = rows.reduce((b, r) => (r.delta < b.delta ? r : b), rows[0]!);
  const pcts = rows.map((r) => r.pct).filter((x): x is number => x !== null);
  const range =
    pcts.length > 0
      ? ` En pourcentage du revenu, l’écart va de ${pctText(Math.min(...pcts))} à ${pctText(Math.max(...pcts))}.`
      : '';
  out.push({
    key: 'ends',
    text: `En euros par mois, l’écart va de ${formatEuroDelta(worst.delta)} (${lowerFirst(worst.label)}) à ${formatEuroDelta(best.delta)} (${lowerFirst(best.label)}).${range}`,
  });
  return out.map((o) => ({ ...o, text: typo(o.text) }));
}
