/**
 * @epjn/engine — public API (SKELETON).
 *
 * TODO(engine-builder): replace the stub below with the real engine described in
 * docs/VISION.md §7 (src/params, src/baseline, src/plan, src/simulate.ts, src/explain.ts).
 *
 * Contract with the site (keep stable):
 *  - pure TypeScript, ESM, no DOM, no I/O, no Date.now();
 *  - the site imports this package as source (`exports` → ./src/index.ts, compiled by Vite);
 *  - `Tier` and `SourceRef` are used by the site's UI primitives (TierBadge, SourceChip);
 *    do not rename them without updating site/src/components/ui/.
 *  - the site NEVER computes tax logic itself: everything goes through `simulate()`.
 */

export const ENGINE_VERSION = '0.0.0';

/** The three epistemic tiers of every figure (VISION §2.3). */
export const TIERS = ['law', 'announced', 'hypothesis'] as const;

/**
 * - `law`        « Écrit dans la loi » — amendment text.
 * - `announced`  « Annoncé par les auteurs » — fiches / manifesto / workbook, no legal text.
 * - `hypothesis` « Hypothèse du simulateur » — our choice where the text is silent.
 */
export type Tier = (typeof TIERS)[number];

export interface SourceRef {
  /** Short human label, e.g. « Amendement PLF-P1 n° 28 ». */
  label: string;
  url?: string;
}

/** One line of the explanation tree (VISION §7 `explain.ts`). Amounts are €/month. */
export interface Component {
  id: string;
  label: string;
  amount: number;
  /** Formula rendered with the user's own numbers. */
  formula: string;
  sources: SourceRef[];
  tier: Tier;
}

/** TODO(engine-builder): real household model (adults, children, activity, housing, …). */
export interface Household {
  adults: number;
  children: number;
}

export type Scenario = 'baseline' | 'plan';

export interface SimulationOptions {
  /** `steady` = régime de croisière (2030 rules, 2026 €). */
  year: 'steady' | 2027 | 2028 | 2029 | 2030;
}

export interface SimulationResult {
  /** Disposable income, €/month. Must equal the sum of `components`. */
  disposable: number;
  components: Component[];
}

/** TODO(engine-builder): implement. Placeholder signature only. */
export function simulate(
  _household: Household,
  _scenario: Scenario,
  _options: SimulationOptions = { year: 'steady' },
): SimulationResult {
  throw new Error('@epjn/engine: simulate() is not implemented yet');
}
