import type { SourceRef } from '../types.ts';

/**
 * Every parameter of the engine: value, unit, effective date, source (label + url) and status.
 * status: official | official_republished | oracle | derived (baseline JSON legend) ;
 *         legal_text | site_claim | workbook | inferred (plan) ; approximation | hypothesis (engine choices).
 */
export interface ParamMeta {
  readonly value: unknown;
  readonly unit: string;
  readonly effective: string;
  readonly source: SourceRef;
  readonly status: string;
}
