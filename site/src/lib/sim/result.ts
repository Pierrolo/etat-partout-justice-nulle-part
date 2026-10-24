/**
 * Pure derivations from an engine `Comparison` to what the result UI shows.
 * No tax logic: only joining, ordering, signs and wording. All numbers become strings via lib/format.
 */
import type {
  Comparison,
  Component,
  ComponentGroup,
  Period,
  ScenarioResult,
  SourceRef,
  Tier,
  WaterfallStep,
} from '@/lib/engine-types';
import { formatEuro, formatEuroDelta, formatPercent, roundForDisplay } from '@/lib/format';

export const PERIODS: Period[] = ['steady', 2027, 2028, 2030];

export const periodLabel = (p: Period) => (p === 'steady' ? 'Plan complet' : String(p));
export const periodLong = (p: Period) =>
  p === 'steady' ? 'Plan complet appliqué à 2026' : `Année ${p}, mesures alors en vigueur`;

export const GROUP_LABEL: Record<ComponentGroup, string> = {
  revenus: 'Revenus',
  prelevements: 'Prélèvements',
  prestations: 'Prestations et allocations',
  impots_indirects: 'Impôts indirects',
};
export const GROUP_ORDER: ComponentGroup[] = [
  'revenus',
  'prelevements',
  'prestations',
  'impots_indirects',
];

/** Rounding step for € figures shown as results (avoid false precision). */
export const DISPLAY_STEP = 5;

export type Direction = 'gain' | 'loss' | 'flat';

export const directionOf = (rounded: number): Direction =>
  rounded > 0 ? 'gain' : rounded < 0 ? 'loss' : 'flat';

export interface Headline {
  direction: Direction;
  /** « +210 €/mois » (signed, rounded to 5 €). */
  amount: string;
  /** « +9 % » */
  percent: string;
  /** « 210 € de plus par mois » — spoken form, sign-free. */
  words: string;
  /** « Soit environ 7 € par jour ». */
  perDay: string;
  from: string;
  to: string;
  roundedDelta: number;
}

export function percentDigits(ratio: number): number {
  return Math.abs(ratio) < 0.1 ? 1 : 0;
}

export function buildHeadline(c: Comparison): Headline {
  const fig = displayFigures(c);
  const rounded = fig.delta;
  const direction = directionOf(rounded);
  const abs = Math.abs(rounded);
  const perDay = Math.abs(rounded * 12) / 365;
  return {
    direction,
    roundedDelta: rounded,
    amount: `${formatEuroDelta(rounded)}/mois`,
    percent: formatPercent(fig.pct, { signed: true, decimals: percentDigits(fig.pct) }),
    words:
      direction === 'flat'
        ? 'pas de différence notable'
        : `${formatEuro(abs)} de ${direction === 'gain' ? 'plus' : 'moins'} par mois`,
    perDay:
      direction === 'flat'
        ? ''
        : `Soit environ ${formatEuro(perDay, { decimals: perDay < 10 ? { min: 0, max: 1 } : 0 })} par jour`,
    from: formatEuro(fig.baseline),
    to: formatEuro(fig.plan),
  };
}

/** Lead-in of the headline sentence, depending on the period shown. */
export function headlineLead(period: Period): string {
  return period === 'steady'
    ? 'Avec le plan complet appliqué à votre situation de 2026, votre ménage disposerait de'
    : `En ${period}, avec les mesures alors en vigueur, appliquées à votre situation de 2026, votre ménage disposerait de`;
}

/** Full plain-text sentence (aria-live, copy, tests). */
export function headlineSentence(c: Comparison, period: Period): string {
  const h = buildHeadline(c);
  if (h.direction === 'flat')
    return `${headlineLead(period)} à peu près le même revenu qu’aujourd’hui (écart inférieur à ${formatEuro(DISPLAY_STEP)} par mois).`;
  return `${headlineLead(period)} ${h.amount} (${h.percent}).`;
}

/* ── Side-by-side table ─────────────────────────────────────────────────── */

export interface JoinedRow {
  key: string;
  id: string;
  personIndex?: number;
  label: string;
  group: ComponentGroup;
  before: number;
  after: number;
  delta: number;
  tierBefore: Tier;
  tierAfter: Tier;
  formulaBefore: string;
  formulaAfter: string;
  sources: SourceRef[];
}

const compKey = (c: Pick<Component, 'id' | 'personIndex'>) => `${c.id}|${c.personIndex ?? ''}`;

/** Baseline and plan components joined on (id, personIndex); lines at 0 € on both sides are dropped. */
export function joinComponents(c: Comparison): JoinedRow[] {
  const base = new Map(c.baseline.components.map((x) => [compKey(x), x]));
  const plan = new Map(c.plan.components.map((x) => [compKey(x), x]));
  const keys = [...new Set([...base.keys(), ...plan.keys()])];
  const rows: JoinedRow[] = [];
  for (const key of keys) {
    const b = base.get(key);
    const p = plan.get(key);
    const ref = (p ?? b)!;
    const before = b?.amount ?? 0;
    const after = p?.amount ?? 0;
    if (Math.abs(before) < 0.5 && Math.abs(after) < 0.5) continue;
    const sources = [...(p?.sources ?? []), ...(b?.sources ?? [])].filter(
      (s, i, a) => a.findIndex((x) => x.label === s.label && x.url === s.url) === i,
    );
    rows.push({
      key,
      id: ref.id,
      personIndex: ref.personIndex,
      label: ref.label,
      group: ref.group,
      before,
      after,
      delta: after - before,
      tierBefore: b?.tier ?? ref.tier,
      tierAfter: p?.tier ?? ref.tier,
      formulaBefore: b?.formula ?? '—',
      formulaAfter: p?.formula ?? '—',
      sources,
    });
  }
  return rows.sort((x, y) => GROUP_ORDER.indexOf(x.group) - GROUP_ORDER.indexOf(y.group));
}

/* ── Waterfall geometry ─────────────────────────────────────────────────── */

export interface BridgeRow {
  step: WaterfallStep;
  from: number;
  to: number;
}

export interface Bridge {
  rows: BridgeRow[];
  min: number;
  max: number;
  total: number;
}

/** Cumulative « bridge » of the deltas, starting at 0 (= today's disposable income). */
export function buildBridge(steps: WaterfallStep[]): Bridge {
  let cum = 0;
  let min = 0;
  let max = 0;
  const rows = steps.map((step) => {
    const from = cum;
    cum += step.delta;
    min = Math.min(min, cum, from);
    max = Math.max(max, cum, from);
    return { step, from, to: cum };
  });
  return { rows, min, max, total: cum };
}

/** Bar geometry in % of the track: { left, width } for a segment between two cumulative values. */
export function barBox(bridge: Bridge, from: number, to: number): { left: number; width: number } {
  const span = bridge.max - bridge.min || 1;
  const pad = span * 0.04;
  const lo = bridge.min - pad;
  const total = span + pad * 2;
  const a = Math.min(from, to);
  const b = Math.max(from, to);
  return { left: ((a - lo) / total) * 100, width: Math.max(((b - a) / total) * 100, 0.8) };
}

export function zeroLeft(bridge: Bridge): number {
  const span = bridge.max - bridge.min || 1;
  const pad = span * 0.04;
  return ((0 - (bridge.min - pad)) / (span + pad * 2)) * 100;
}

/** Monthly transfers received outside the pay slip: benefits today; benefits + AFU with the plan. */
export function transfersOf(r: Pick<ScenarioResult, 'components'>): number {
  return r.components
    .filter((c) => c.group === 'prestations' || c.id === 'afu')
    .reduce((s, c) => s + c.amount, 0);
}

/* ── Display rounding (one rule, everywhere) ───────────────────────────── */

/**
 * Round every value to a multiple of `step` so that the ROUNDED values add up exactly to the rounded
 * sum (largest-remainder method). This is what keeps « components sum to the headline » true on screen.
 */
export function roundSumPreserving(values: number[], step = DISPLAY_STEP): number[] {
  const units = values.map((v) => v / step);
  const floors = units.map(Math.floor);
  let missing = Math.round(units.reduce((s, u) => s + u, 0)) - floors.reduce((s, u) => s + u, 0);
  const order = units
    .map((u, i) => ({ i, r: u - Math.floor(u) }))
    .sort((x, y) => y.r - x.r || x.i - y.i);
  const out = floors.slice();
  for (const { i } of order) {
    if (missing <= 0) break;
    out[i] = out[i]! + 1;
    missing--;
  }
  return out.map((u) => (u === 0 ? 0 : u * step));
}

export interface DisplayRow extends JoinedRow {
  beforeShown: number;
  afterShown: number;
  deltaShown: number;
}

export interface Figures {
  /** Today's disposable income, rounded to 5 €. */
  baseline: number;
  /** = baseline + delta, so the three numbers always agree. */
  plan: number;
  /** The headline, €/month, rounded to 5 €. */
  delta: number;
  /** Relative change (ratio) of the household's disposable income after indirect taxes. */
  pct: number;
  /** Table rows with shown amounts: Σ before = baseline, Σ after = plan. */
  rows: DisplayRow[];
  /** Shown deltas aligned with `comparison.waterfall` (they add up to `delta`). */
  steps: number[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function displayFigures(c: Comparison, step = DISPLAY_STEP): Figures {
  const rows = joinComponents(c);
  const sumBefore = rows.reduce((s, r) => s + r.before, 0);
  const sumAfter = rows.reduce((s, r) => s + r.after, 0);
  const baseline = roundForDisplay(sumBefore, step);
  const delta = roundForDisplay(sumAfter - sumBefore, step);
  const stepsRaw = c.waterfall.map((w) => w.delta);
  const steps = roundSumPreserving(stepsRaw, step);
  // reconcile with the headline if the engine's waterfall does not add up exactly (it should)
  const stepsSum = steps.reduce((s, v) => s + v, 0);
  if (steps.length > 0 && stepsSum !== delta) {
    const k = steps.reduce((best, v, i, a) => (Math.abs(v) > Math.abs(a[best]!) ? i : best), 0);
    steps[k] = steps[k]! + (delta - stepsSum);
  }

  const used = new Set<number>();
  const rowDelta = rows.map((r) => {
    const want = [norm(r.id), norm(`${r.id}${r.personIndex ?? ''}`), norm(r.label)];
    const idx = c.waterfall.findIndex(
      (w, i) => !used.has(i) && (want.includes(norm(w.id)) || norm(w.label) === norm(r.label)),
    );
    if (idx >= 0) {
      used.add(idx);
      return steps[idx]!;
    }
    return roundForDisplay(r.delta, step);
  });
  const beforeShown = roundSumPreserving(
    rows.map((r) => r.before),
    step,
  );
  const shown: DisplayRow[] = rows.map((r, i) => ({
    ...r,
    beforeShown: beforeShown[i]!,
    deltaShown: rowDelta[i]!,
    afterShown: beforeShown[i]! + rowDelta[i]!,
  }));
  const pct = sumBefore > 0 ? (sumAfter - sumBefore) / sumBefore : 0;
  return { baseline, plan: baseline + delta, delta, pct, rows: shown, steps };
}

/* ── Wording ────────────────────────────────────────────────────────────── */

/** « +170 € » / « −90 € » for an amount already rounded for display. */
export const deltaText = (v: number) => formatEuroDelta(v);
