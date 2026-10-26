/**
 * Parameters of the Résolution plan (« État partout, justice nulle part », 2026), copied from the amendment
 * liasses (legal text) and the authors' fiches/workbooks. See research/source-analysis.md §2 and §6,
 * research/reform_parameters.json. `status`: legal_text | site_claim | workbook | inferred | hypothesis.
 */
import type { ParamMeta } from './types.ts';

export const PLF_P1 = {
  label: 'Liasse PLF 2027 — 1re partie (amendements Résolution)',
  url: 'https://france-resolution.fr/amendements/Liasse_PLF_P1.pdf',
};
export const PLF_P2 = {
  label: 'Liasse PLF 2027 — 2de partie (amendements Résolution)',
  url: 'https://france-resolution.fr/amendements/Liasse_PLF_P2.pdf',
};
export const PLFSS = {
  label: 'Liasse PLFSS 2027 (amendements Résolution)',
  url: 'https://france-resolution.fr/amendements/Liasse_PLFSS.pdf',
};

const am = (base: { label: string; url: string }, n: string, what: string) => ({
  label: `${base.label.split(' (')[0]}, am. n° ${n} — ${what}`,
  url: base.url,
});

export const SRC_AM28 = am(PLF_P1, '28', 'taux unique 23 % et aide fondamentale universelle');
export const SRC_AM1_NICHES = am(PLF_P1, '1', 'extinction des dépenses fiscales (III, IV.A-F)');
export const SRC_AM3_DONS = am(PLF_P1, '3', 'réduction d’impôt pour dons');
export const SRC_AM21_TVA = am(PLF_P1, '21', 'taux réduits de TVA portés à 20 %');
export const SRC_CEE = am(PLF_P1, '14-16', 'accises et certificats d’économies d’énergie');
export const SRC_PLFSS1_CSG = am(PLFSS, '1', 'CSG et CRDS supprimées sur les revenus d’activité');
export const SRC_PLFSS7_PF = am(
  PLFSS,
  '7',
  'prestations familiales et action sociale CAF abrogées',
);
export const SRC_PLFSS5_INDEX = am(PLFSS, '5', 'fin de la revalorisation automatique');
export const SRC_PLFSS4_BOUCLIER = am(PLFSS, '4', 'bouclier sanitaire');
export const SRC_P2_32_APL = am(PLF_P2, '32', 'extinction des aides personnelles au logement');
export const SRC_P2_26_FP = am(
  PLF_P2,
  '26',
  'indemnité des agents publics dont le poste est supprimé',
);
export const SRC_P2_34_CHEQUE = am(PLF_P2, '34', 'chèque énergie abrogé');
export const SRC_AM27_CEP = am(PLF_P1, '27', 'compte d’épargne personnel');
export const SRC_AM19_DMTO = am(PLF_P1, '19', 'droits de mutation 1 % / 3 %');
export const SRC_AM20_PV = am(PLF_P1, '20', 'plus-values et épargne : 30 % sur le gain réel');
export const SRC_AM29_TF = am(PLF_P1, '29', 'taxe foncière unique');
export const MANIFESTE = {
  label: 'Manifeste Résolution',
  url: 'https://france-resolution.fr/manifeste.html',
};
export const fiche = (slug: string, title: string) => ({
  label: `Fiche « ${title} »`,
  url: `https://france-resolution.fr/fiches/${slug}.html`,
});

export const PLAN_PARAMS = {
  'plan.flat_rate': {
    value: 0.23,
    unit: 'rate on revenu net imposable',
    effective: 'IR 2028',
    source: SRC_AM28,
    status: 'legal_text',
  },
  'plan.afu_adult': {
    value: 6600,
    unit: 'EUR/year per adult of the foyer fiscal',
    effective: '2028-01-01',
    source: SRC_AM28,
    status: 'legal_text',
  },
  'plan.afu_child': {
    value: 3300,
    unit: 'EUR/year per dependent child until the year they turn 18',
    effective: '2028-01-01',
    source: SRC_AM28,
    status: 'legal_text',
  },
  'plan.afu_child_max_age': {
    value: 18,
    unit: 'years (adult AFU from 18)',
    effective: '2028-01-01',
    source: SRC_AM28,
    status: 'legal_text',
  },
  'plan.afu_invalidity': {
    value: 6600,
    unit: 'EUR/year per holder of the CMI « invalidité »',
    effective: '2028-01-01',
    source: SRC_AM28,
    status: 'legal_text',
  },
  'plan.afu_pension': {
    value: 3300,
    unit: 'EUR/year per holder of a pension liquidated before 1 Jan 2028 (until IR 2051)',
    effective: '2028-01-01',
    source: SRC_AM28,
    status: 'legal_text',
  },
  'plan.afu_pension_cutoff_year': {
    value: 2028,
    unit: 'pension liquidated strictly before 1 January of this year',
    effective: '2028-01-01',
    source: SRC_AM28,
    status: 'legal_text',
  },
  'plan.frais_pro_10_kept': {
    value: true,
    unit: 'boolean (H2: art. 83 3° CGI not abrogated)',
    effective: '2028-01-01',
    source: {
      label:
        'Hypothèse H2 : l’art. 83 3° CGI (déduction 10 %) ne figure pas dans les abrogations de l’am. 1 III',
    },
    status: 'hypothesis',
  },
  'plan.csg_activity_2027': {
    value: [
      { csg: 0.092, crds: 0.005 },
      { csg: 0.092, crds: 0.005 },
      { csg: 0.092, crds: 0.005 },
      { csg: 0.092, crds: 0.005 },
      { csg: 0.092, crds: 0.005 },
      { csg: 0.092, crds: 0.005 },
      { csg: 0.076, crds: 0.005 },
      { csg: 0.06, crds: 0.005 },
      { csg: 0.043, crds: 0.005 },
      { csg: 0.027, crds: 0.005 },
      { csg: 0.011, crds: 0.005 },
      { csg: 0, crds: 0 },
    ],
    unit: 'monthly CSG and CRDS rates on earned income, Jan..Dec 2027 (0 from 1 Dec 2027)',
    effective: '2027-07-01',
    source: SRC_PLFSS1_CSG,
    status: 'legal_text',
  },
  'plan.pension_abattement_abolished_income_year': {
    value: 2026,
    unit: 'first income year without the 10 % pension abattement (IR paid in 2027)',
    effective: 'IR 2026',
    source: SRC_AM1_NICHES,
    status: 'inferred',
  },
  'plan.prestations_familiales_end': {
    value: '2028-01-01',
    unit: 'date (9 prestations familiales of L.511-1 CSS + action sociale CAF)',
    effective: '2028-01-01',
    source: SRC_PLFSS7_PF,
    status: 'legal_text',
  },
  'plan.apl_existing_factor': {
    value: [
      { from: '2027-07-01', factor: 2 / 3 },
      { from: '2028-07-01', factor: 1 / 3 },
      { from: '2029-07-01', factor: 0 },
    ],
    unit: 'share of the Dec-2026 amount kept for existing rights (conventioned housing); all aides personnelles abolished 1 Jan 2030',
    effective: '2027-07-01',
    source: SRC_P2_32_APL,
    status: 'legal_text',
  },
  'plan.tva_niches_end': {
    value: '2027-07-01',
    unit: 'date (reduced rates counted as tax expenditures → 20 %)',
    effective: '2027-07-01',
    source: SRC_AM1_NICHES,
    status: 'legal_text',
  },
  'plan.tva_reduced_to_normal': {
    value: '2028-07-01',
    unit: 'date (10 %, 5,5 %, 2,1 % → 20 %, except food)',
    effective: '2028-07-01',
    source: SRC_AM21_TVA,
    status: 'legal_text',
  },
  'plan.tva_food_path': {
    value: [
      { from: '2028-07-01', rate: 0.1 },
      { from: '2029-07-01', rate: 0.15 },
      { from: '2030-07-01', rate: 0.2 },
    ],
    unit: 'VAT rate on food (L.213-159 / L.213-166 CIBS)',
    effective: '2028-07-01',
    source: SRC_AM21_TVA,
    status: 'legal_text',
  },
  'plan.niches_garde_emploi_domicile': {
    value: [
      { year: 2027, factor: 2 / 3 },
      { year: 2028, factor: 1 / 3 },
      { year: 2029, factor: 0 },
    ],
    unit: 'share of the credit kept (garde d’enfants, emploi à domicile)',
    effective: '2027-01-01',
    source: SRC_AM1_NICHES,
    status: 'legal_text',
  },
  'plan.niches_dons': {
    value: [
      { from: '2027-07-01', factor: 0.5 },
      { from: '2028-01-01', factor: 0 },
    ],
    unit: 'share of the réduction pour dons kept',
    effective: '2027-07-01',
    source: SRC_AM3_DONS,
    status: 'legal_text',
  },
  'plan.cee_end': {
    value: '2027-07-01',
    unit: 'date (CEE abrogated: energy prices fall by their cost)',
    effective: '2027-07-01',
    source: SRC_CEE,
    status: 'legal_text',
  },
  'plan.minima_replaced_from': {
    value: '2028-01-01',
    unit: 'date (RSA, prime d’activité, AAH, ASPA replaced by the AFU — H1)',
    effective: '2028-01-01',
    source: MANIFESTE,
    status: 'site_claim',
  },
} as const satisfies Record<string, ParamMeta>;

export type PlanKey = keyof typeof PLAN_PARAMS;
