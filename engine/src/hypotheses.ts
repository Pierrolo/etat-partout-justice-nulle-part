import type { Hypotheses, PlanSwitches } from './types.ts';

export const DEFAULT_HYPOTHESES: Hypotheses = {
  H1_benefits: 'replaced',
  H2_fraisPro10: true,
  H5_tvaPassThrough: 1,
  includeTva: true,
};

export function resolveHypotheses(p?: Partial<Hypotheses>): Hypotheses {
  const h = { ...DEFAULT_HYPOTHESES };
  if (!p) return h;
  if (p.H1_benefits === 'replaced' || p.H1_benefits === 'differential')
    h.H1_benefits = p.H1_benefits;
  if (typeof p.H2_fraisPro10 === 'boolean') h.H2_fraisPro10 = p.H2_fraisPro10;
  if (p.H5_tvaPassThrough === 0 || p.H5_tvaPassThrough === 0.5 || p.H5_tvaPassThrough === 1)
    h.H5_tvaPassThrough = p.H5_tvaPassThrough;
  if (typeof p.includeTva === 'boolean') h.includeTva = p.includeTva;
  return h;
}

export const ALL_SWITCHES_ON: PlanSwitches = {
  csgActivite: true,
  flatTaxAfu: true,
  pensionAbattement: true,
  prestationsFamiliales: true,
  aidesLogement: true,
  minimaSociaux: true,
  niches: true,
  tva: true,
  cee: true,
};

export const ALL_SWITCHES_OFF: PlanSwitches = {
  csgActivite: false,
  flatTaxAfu: false,
  pensionAbattement: false,
  prestationsFamiliales: false,
  aidesLogement: false,
  minimaSociaux: false,
  niches: false,
  tva: false,
  cee: false,
};
