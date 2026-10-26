/**
 * What the result is computed from: the validated household, the hypotheses and the period, plus the
 * helpers shared by the simulator island (comparison of two states, safe computation).
 */
import type {
  Comparison,
  DisplayComparison,
  Household,
  Hypotheses,
  Period,
} from '@/lib/engine-types';
import type { EngineModule } from './engine-lazy';

export interface Committed {
  household: Household;
  hyp: Hypotheses;
  period: Period;
}

export interface ResultData {
  comparison: Comparison;
  /** The engine's `roundForDisplay`: every figure on screen comes from here. */
  display: DisplayComparison;
}

export type Computed = ({ error: null } & ResultData) | { error: string };

export function computeResult(
  engine: Pick<EngineModule, 'compare' | 'roundForDisplay'>,
  c: Committed,
): Computed {
  try {
    const comparison = engine.compare(c.household, { period: c.period, hypotheses: c.hyp });
    return { error: null, comparison, display: engine.roundForDisplay(comparison) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur de calcul' };
  }
}

export const sameState = (a: Committed, b: Committed) =>
  JSON.stringify([a.household, a.hyp, a.period]) === JSON.stringify([b.household, b.hyp, b.period]);
