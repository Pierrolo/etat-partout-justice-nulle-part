/**
 * Comparison deltas of every standard household (CAS_TYPES), for humans to eyeball winners and losers.
 * Used by test/cas-types.test.ts (snapshot) and scripts/gen-cas-types.ts (engine/cas-types-results.json).
 */
import { CAS_TYPES, compare, ENGINE_VERSION, PARAMS_META, type Period } from '../src/index.ts';

const r0 = (x: number) => Math.round(x);
const r1 = (x: number) => Math.round(x * 10) / 10;

export function casTypesResults() {
  const periods: Period[] = [2027, 2028, 2030, 'steady'];
  const rows = CAS_TYPES.map((c) => {
    const steady = compare(c.household);
    const transition: Record<string, number> = {};
    for (const p of periods) transition[String(p)] = r0(compare(c.household, { period: p }).delta);
    return {
      id: c.id,
      family: c.family,
      label: c.label,
      baseline: r0(steady.baseline.disposable),
      plan: r0(steady.plan.disposable),
      delta: r0(steady.delta),
      deltaPct: r1(steady.deltaPct * 100),
      deltaAfterTva: r0(steady.deltaAfterTva),
      waterfall: Object.fromEntries(steady.waterfall.map((w) => [w.id, r0(w.delta)])),
      transition,
      variants: {
        H1_differential: r0(compare(c.household, { hypotheses: { H1_benefits: 'differential' } }).delta),
        H2_off: r0(compare(c.household, { hypotheses: { H2_fraisPro10: false } }).delta),
        H5_noPassThroughAfterTva: r0(compare(c.household, { hypotheses: { H5_tvaPassThrough: 0 } }).deltaAfterTva),
      },
    };
  });
  return {
    _meta: {
      description:
        'Cas-types illustratifs, NON pondérés : variation du revenu disponible mensuel (€/mois, hors TVA sauf deltaAfterTva) entre la législation 2026 et le plan complet appliqué à 2026 (hypothèses par défaut : H1 remplacées, H2 frais pro maintenus, H5 répercussion 100 %). transition = variation moyenne mensuelle par année.',
      engineVersion: ENGINE_VERSION,
      baseline: PARAMS_META.baselineYear,
      plan: PARAMS_META.planSource,
      generatedBy: 'pnpm --filter @epjn/engine gen:cas-types',
    },
    winners: rows.filter((r) => r.delta > 0).length,
    losers: rows.filter((r) => r.delta < 0).length,
    cases: rows,
  };
}
