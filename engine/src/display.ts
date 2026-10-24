/**
 * v1.1 `roundForDisplay(comparison)`: every figure of a comparison rounded to 5 € with the largest-remainder
 * method, so that the shown lines add up exactly to the shown totals and every screen (desktop, mobile, share
 * card) shows the same numbers.
 *
 * Rules: headline totals are rounded directly (baseline, delta, indirect taxes before/after); the per-line
 * amounts are then distributed by largest remainder so that Σ lines = the rounded total; after = before + delta.
 */
import type { Comparison, ComponentGroup, ComponentId } from './types.ts';

export interface DisplayLine {
  id: ComponentId;
  label: string;
  group: ComponentGroup;
  before: number;
  after: number;
  delta: number;
}

export interface DisplayComparison {
  step: number;
  /** today's disposable income (before TVA) */
  baseline: number;
  /** = baseline + delta */
  plan: number;
  /** the headline */
  delta: number;
  baselineAfterTva: number;
  planAfterTva: number;
  /** = delta + Σ indirect-tax deltas */
  deltaAfterTva: number;
  /** same as comparison.deltaPct (ratio, or null) — not rounded */
  deltaPct: number | null;
  /** every component non-zero on either side, in COMPONENT_IDS order; Σ(non-indirect).before = baseline … */
  lines: DisplayLine[];
  /** rounded waterfall steps, same order as comparison.waterfall; Σ(non-indirect) = delta */
  waterfall: Array<{ id: ComponentId; delta: number }>;
}

const zero = (x: number) => (Object.is(x, -0) ? 0 : x);
const roundStep = (x: number, step: number) => zero(Math.round(x / step + 1e-9) * step);

/** Largest-remainder rounding of `values` to multiples of `step`, summing to `round(Σ values)`. */
export function roundSumPreserving(values: number[], step = 5, target?: number): number[] {
  const units = values.map((v) => v / step);
  const floors = units.map((u) => Math.floor(u + 1e-9));
  const total =
    target === undefined
      ? Math.round(units.reduce((s, u) => s + u, 0) + 1e-9)
      : Math.round(target / step);
  let k = total - floors.reduce((s, f) => s + f, 0);
  const order = units
    .map((u, i) => ({ i, rem: u - floors[i]! }))
    .sort((a, b) => b.rem - a.rem || Math.abs(values[b.i]!) - Math.abs(values[a.i]!) || a.i - b.i);
  const out = [...floors];
  // k is in [0, n] for a free target; clamp defensively for an imposed target
  for (let j = 0; k > 0 && order.length > 0; j = (j + 1) % order.length, k--)
    out[order[j]!.i]! += 1;
  for (
    let j = order.length - 1;
    k < 0 && order.length > 0;
    j = (j - 1 + order.length) % order.length, k++
  )
    out[order[j]!.i]! -= 1;
  return out.map((u) => zero(u * step));
}

export function roundForDisplay(c: Comparison, step = 5): DisplayComparison {
  const isInd = (g: ComponentGroup) => g === 'impots_indirects';
  const rows = c.baseline.components
    .map((b) => {
      const p = c.plan.components.find((x) => x.id === b.id)!;
      return { id: b.id, label: b.label, group: b.group, before: b.amount, after: p.amount };
    })
    .filter((r) => Math.abs(r.before) >= 0.005 || Math.abs(r.after) >= 0.005);

  const baseline = roundStep(c.baseline.disposable, step);
  const delta = roundStep(c.delta, step);
  const indBeforeRaw = c.baseline.disposableAfterTva - c.baseline.disposable;
  const indDeltaRaw = c.deltaAfterTva - c.delta;
  const indBefore = roundStep(indBeforeRaw, step);
  const indDelta = roundStep(indDeltaRaw, step);

  const distribute = (pick: (r: (typeof rows)[number]) => number, ind: boolean, target: number) => {
    const idx = rows.map((r, i) => (isInd(r.group) === ind ? i : -1)).filter((i) => i >= 0);
    const vals = roundSumPreserving(
      idx.map((i) => pick(rows[i]!)),
      step,
      target,
    );
    const out = new Map<number, number>();
    idx.forEach((i, j) => out.set(i, vals[j]!));
    return out;
  };
  const before = new Map([
    ...distribute((r) => r.before, false, baseline),
    ...distribute((r) => r.before, true, indBefore),
  ]);
  const deltas = new Map([
    ...distribute((r) => r.after - r.before, false, delta),
    ...distribute((r) => r.after - r.before, true, indDelta),
  ]);
  const lines: DisplayLine[] = rows.map((r, i) => {
    const b = before.get(i) ?? 0;
    const d = deltas.get(i) ?? 0;
    return { id: r.id, label: r.label, group: r.group, before: b, after: zero(b + d), delta: d };
  });
  const byId = new Map(lines.map((l) => [l.id, l.delta]));
  return {
    step,
    baseline,
    plan: zero(baseline + delta),
    delta,
    baselineAfterTva: zero(baseline + indBefore),
    planAfterTva: zero(baseline + delta + indBefore + indDelta),
    deltaAfterTva: zero(delta + indDelta),
    deltaPct: c.deltaPct,
    lines,
    waterfall: c.waterfall.map((w) => ({ id: w.id, delta: byId.get(w.id) ?? 0 })),
  };
}
