/**
 * Pure derivations from an engine `Comparison` (+ its `DisplayComparison`) to what the result UI shows.
 * No tax logic: only joining, ordering, signs and wording. All numbers become strings via lib/format, and
 * every displayed amount comes from the engine's `roundForDisplay` so that all screens show identical
 * figures (docs/ENGINE-API.md, v1.1). This module never imports the engine at runtime (it is loaded lazily).
 */
import type {
  Comparison,
  ComponentGroup,
  DisplayComparison,
  Period,
  SourceRef,
  UnquantifiedItem,
  WaterfallStep,
} from '@/lib/engine-types';
import { EM_DASH, formatEuro, formatEuroDelta, formatPercent } from '@/lib/format';
import { typo } from '@/lib/typo';

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

/* ── Percentages ────────────────────────────────────────────────────────── */

/**
 * Relative change on the SAME basis as the headline figures (after the estimated TVA): the engine's
 * `deltaPct` is measured before indirect taxes, so a reader dividing « +660 € » by « 3 090 € » would not
 * find it. The engine decides WHEN a percentage is meaningful: `null` (today's income ≤ 50 €/month) stays
 * `null` here, and the UI shows « — », never « 0,0 % ».
 */
export function headlinePct(c: Comparison): number | null {
  if (c.deltaPct === null) return null;
  const base = c.baseline.disposableAfterTva;
  return base > 0 ? c.deltaAfterTva / base : null;
}

export function percentDigits(ratio: number): number {
  return Math.abs(ratio) < 0.1 ? 1 : 0;
}

/** « +22 % », « −3,6 % », and « — » when the engine says the percentage is meaningless (null). */
export function pctText(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return EM_DASH;
  return formatPercent(ratio, { signed: true, decimals: percentDigits(ratio) });
}

/** Spoken form for a screen reader: « variation non calculée » when null. */
export const pctSpoken = (ratio: number | null | undefined) =>
  ratio === null || ratio === undefined || !Number.isFinite(ratio)
    ? 'variation en pourcentage non calculée'
    : pctText(ratio);

/* ── Headline ───────────────────────────────────────────────────────────── */

export interface Headline {
  direction: Direction;
  /** The headline, €/month, rounded for display (after the estimated TVA). */
  delta: number;
  /** « +210 €/mois » (signed). */
  amount: string;
  /** « +9 % », or « — » when it would be meaningless. */
  percent: string;
  pct: number | null;
  /** « 210 € de plus par mois » — spoken form, sign-free. */
  words: string;
  /** « Soit environ 7 € par jour ». */
  perDay: string;
  baseline: number;
  plan: number;
  /** What the figure is after: « après impôts, aides et TVA estimée ». */
  basis: string;
}

const tvaCounted = (c: Comparison) =>
  (c.activeHypotheses.find((h) => h.id === 'includeTva')?.value ?? 'oui').startsWith('oui');

export const BASIS_WITH_TVA = 'après impôts, aides et TVA estimée';
export const BASIS_NO_TVA = 'après impôts et aides, sans la TVA';

export function buildHeadline(c: Comparison, d: DisplayComparison): Headline {
  const rounded = d.deltaAfterTva;
  const direction = directionOf(rounded);
  const abs = Math.abs(rounded);
  const perDay = Math.abs(rounded * 12) / 365;
  const pct = headlinePct(c);
  return {
    direction,
    delta: rounded,
    amount: `${formatEuroDelta(rounded)}/mois`,
    percent: pctText(pct),
    pct,
    words:
      direction === 'flat'
        ? 'pas de différence notable'
        : `${formatEuro(abs)} de ${direction === 'gain' ? 'plus' : 'moins'} par mois`,
    perDay:
      direction === 'flat'
        ? ''
        : `Soit environ ${formatEuro(perDay, { decimals: perDay < 10 ? { min: 0, max: 1 } : 0 })} par jour`,
    baseline: d.baselineAfterTva,
    plan: d.planAfterTva,
    basis: tvaCounted(c) ? BASIS_WITH_TVA : BASIS_NO_TVA,
  };
}

/** Lead-in of the headline sentence, depending on the period shown. */
export function headlineLead(period: Period): string {
  return period === 'steady'
    ? 'Avec le plan complet appliqué à votre situation de 2026, votre ménage aurait'
    : `En ${period}, avec les mesures alors en vigueur, appliquées à votre situation de 2026, votre ménage aurait`;
}

/** Full plain-text sentence (screen readers, share text, tests). */
export function headlineSentence(c: Comparison, d: DisplayComparison, period: Period): string {
  const h = buildHeadline(c, d);
  if (h.direction === 'flat')
    return typo(
      `${headlineLead(period).replace('aurait', 'aurait à peu près le même revenu qu’aujourd’hui')} (écart inférieur à ${formatEuro(DISPLAY_STEP)} par mois, ${h.basis}).`,
    );
  const pct = h.pct === null ? '' : ` (${h.percent})`;
  return typo(`${headlineLead(period)} ${h.words}${pct}, ${h.basis}.`);
}

/** The short sentence announced politely after each recomputation (the long one stays static text). */
export function announcement(c: Comparison, d: DisplayComparison): string {
  const h = buildHeadline(c, d);
  if (h.direction === 'flat') return 'Résultat mis à jour : pas de différence notable.';
  return typo(`Résultat mis à jour : ${h.amount}${h.pct === null ? '' : ` (${h.percent})`}.`);
}

/** Text of the native share sheet / clipboard message. */
export function shareText(c: Comparison, d: DisplayComparison): string {
  const h = buildHeadline(c, d);
  const what =
    h.direction === 'flat'
      ? 'à peu près le même revenu qu’aujourd’hui'
      : h.direction === 'gain'
        ? `${formatEuro(Math.abs(h.delta))} de plus par mois`
        : `${formatEuro(Math.abs(h.delta))} de moins par mois`;
  return typo(
    `Ce que le plan « État partout, justice nulle part » changerait pour un foyer comme le mien : ${what} (estimation, outil indépendant).`,
  );
}

/* ── Sources, formulas: cleaning for display ────────────────────────────── */

/** Replaces a developer path (« voir docs/METHODE.md ») with a reader-facing pointer, never a file path. */
export function plainText(s: string): string {
  return typo(
    s
      .replace(/\(?\s*voir\s+docs\/[\w./#-]+\s*\)?/gi, '(voir la page Méthode)')
      .replace(/\bdocs\/[\w./#-]+/g, 'la page Méthode'),
  );
}

/**
 * One chip per distinct source: compound labels (« A ; B ») are split, and an entry whose parts were all
 * seen already is dropped (the engine lists « loi 2026-103 art. 4 » and « loi 2026-103 art. 4 ; BOFiP… »).
 */
export function uniqueSources(sources: SourceRef[]): SourceRef[] {
  const seen = new Set<string>();
  const key = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const out: SourceRef[] = [];
  for (const src of sources) {
    const parts = src.label.split(/\s;\s/).map(key).filter(Boolean);
    const fresh = parts.filter((p) => !seen.has(p));
    parts.forEach((p) => seen.add(p));
    if (fresh.length === 0) continue;
    out.push({ ...src, label: plainText(src.label) });
  }
  return out;
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

/**
 * « Nice » axis ticks (1, 2, 5 × 10ⁿ steps) between `start` and `stop`, about `count` of them. A few lines
 * instead of d3's `ticks`: importing the `d3` barrel pulls the whole library (selection, transitions…) into
 * the page's first JavaScript for one function.
 */
export function niceTicks(start: number, stop: number, count: number): number[] {
  if (!(stop > start) || count < 1) return [start];
  const raw = (stop - start) / count;
  const power = Math.floor(Math.log10(raw));
  const err = raw / 10 ** power;
  const step =
    (err >= Math.sqrt(50) ? 10 : err >= Math.sqrt(10) ? 5 : err >= Math.sqrt(2) ? 2 : 1) *
    10 ** power;
  const out: number[] = [];
  for (let t = Math.ceil(start / step) * step; t <= stop + step * 1e-9; t += step)
    out.push(Number((Math.round(t / step) * step).toFixed(12)));
  return out;
}

export function zeroLeft(bridge: Bridge): number {
  const span = bridge.max - bridge.min || 1;
  const pad = span * 0.04;
  return ((0 - (bridge.min - pad)) / (span + pad * 2)) * 100;
}

/* ── Waterfall steps with their displayed amount ────────────────────────── */

export interface ShownStep extends WaterfallStep {
  key: string;
  /** Amount shown (engine `roundForDisplay`): the steps add up exactly to the headline. */
  shown: number;
}

export function shownSteps(c: Comparison, d: DisplayComparison): ShownStep[] {
  return c.waterfall.map((w, i) => ({
    ...w,
    key: `${w.id}#${i}`,
    shown: d.waterfall[i]?.delta ?? 0,
    sources: uniqueSources(w.sources),
    formulaBefore: plainText(w.formulaBefore),
    formulaAfter: plainText(w.formulaAfter),
  }));
}

/* ── Unquantified items ─────────────────────────────────────────────────── */

export const unqTitle = (it: UnquantifiedItem) => it.plainTitle ?? it.title;

/** Items that could plausibly exceed ~50 €/month for this household: shown next to the headline. */
export const prominentLosses = (c: Comparison) =>
  c.unquantified.losses.filter((it) => it.prominent === true);
export const prominentPromises = (c: Comparison) =>
  c.unquantified.promises.filter((it) => it.prominent === true);

/** Splits « Aujourd’hui : … Avec le plan — A ; B ; C. » into its parts (falls back to the whole text). */
export function certaintyParts(certainty: string): { intro: string; items: string[] } {
  const m = /^(.*?)\s—\s(.*?)\.?$/.exec(certainty);
  if (!m) return { intro: certainty, items: [] };
  const items = m[2]!.split(/\s;\s/).filter(Boolean);
  return { intro: m[1]!.replace(/\s*Avec le plan$/, '').trim(), items };
}
