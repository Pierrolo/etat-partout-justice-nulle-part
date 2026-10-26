/** « Si je gagnais plus ? » — disposable income as the first adult's net salary varies (steady state). */
import { evaluate } from './simulate.ts';
import type { Adult, Household, Hypotheses } from './types.ts';

export interface CurvePoint {
  /** net monthly salary TODAY (x axis) */
  netToday: number;
  gross: number;
  /** disposable income (before TVA), baseline and plan */
  baseline: number;
  plan: number;
  /** marginal effective tax rate on each scenario's own net salary: 1 − Δdisposable / Δsalaire net */
  mtrBaseline: number;
  mtrPlan: number;
  /** engine extension: same, relative to the gross salary */
  mtrBaselineGross: number;
  mtrPlanGross: number;
  /** engine extension: disposable income after TVA/CEE */
  baselineAfterTva: number;
  planAfterTva: number;
}

export function withFirstAdultNet(h: Household, net: number): Household {
  const a0 = h.adults[0];
  const status = a0.salary?.status ?? 'prive';
  const salary: NonNullable<Adult['salary']> = { amount: net, basis: 'net', status };
  if (a0.salary?.workRatio !== undefined) salary.workRatio = a0.salary.workRatio;
  const adult: Adult = {
    ...a0,
    activity: a0.activity === 'etudiant' ? 'etudiant' : 'salarie',
    salary,
  };
  delete adult.unemployment;
  delete adult.pension;
  const adults = (h.adults.length === 2 ? [adult, h.adults[1]] : [adult]) as Household['adults'];
  return { ...h, adults };
}

export function earningsCurve(
  h: Household,
  opts: { hypotheses?: Partial<Hypotheses>; maxNet?: number; step?: number } = {},
): CurvePoint[] {
  const maxNet = Math.max(0, opts.maxNet ?? 6000);
  let step = Math.max(1, opts.step ?? 50);
  if (maxNet / step > 600) step = maxNet / 600;
  const raw: Array<{
    netToday: number;
    gross: number;
    b: number;
    p: number;
    bNet: number;
    pNet: number;
    bT: number;
    pT: number;
  }> = [];
  for (let x = 0; x <= maxNet + 1e-9; x += step) {
    const e = evaluate(
      withFirstAdultNet(h, x),
      opts.hypotheses ? { hypotheses: opts.hypotheses } : {},
    );
    const sal = (r: typeof e.baseline) => r.perAdult[0]?.net ?? 0;
    raw.push({
      netToday: x,
      gross: e.baseline.perAdult[0]?.gross ?? 0,
      b: e.baseline.disposable,
      p: e.plan!.disposable,
      bNet: sal(e.baseline),
      pNet: sal(e.plan!),
      bT: e.baseline.disposableAfterTva,
      pT: e.plan!.disposableAfterTva,
    });
  }
  const mtr = (dy: number, dx: number) => (dx > 1e-9 ? 1 - dy / dx : 0);
  return raw.map((r, i) => {
    const j = i + 1 < raw.length ? i + 1 : i;
    const k = i + 1 < raw.length ? i : i - 1;
    const a = raw[k] ?? r;
    const b = raw[j] ?? r;
    return {
      netToday: r.netToday,
      gross: r.gross,
      baseline: r.b,
      plan: r.p,
      mtrBaseline: mtr(b.b - a.b, b.bNet - a.bNet),
      mtrPlan: mtr(b.p - a.p, b.pNet - a.pNet),
      mtrBaselineGross: mtr(b.b - a.b, b.gross - a.gross),
      mtrPlanGross: mtr(b.p - a.p, b.gross - a.gross),
      baselineAfterTva: r.bT,
      planAfterTva: r.pT,
    };
  });
}
