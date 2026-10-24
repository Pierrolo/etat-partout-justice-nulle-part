/**
 * Baseline parameters that research/baseline/parameters.json does not cover but the engine contract needs
 * (cadres, fonctionnaires, chômage, AEEH, dons, emploi à domicile, TVA curve, CEE).
 * Hand-written. `status` says how solid each value is: `official` (read in the legal/official source cited),
 * `approximation` (simplified on purpose — see METHODE.md), `hypothesis` (engine choice, visible in the
 * hypotheses register).
 */
import type { ParamMeta } from './types.ts';

const URSSAF_2026 = {
  label: 'Taux de cotisations 2026 (legisocial.fr, reprise des taux URSSAF / APEC)',
  url: 'https://www.legisocial.fr/reperes-sociaux/taux-cotisations-sociales-urssaf-2026.html',
};
const CNRACL = {
  label:
    'Décret n° 2025-86 du 30/01/2025 (taux employeur CNRACL relevé de 3 points par an 2025-2028) — à vérifier',
};
const PCMR = {
  label:
    'Code des pensions civiles et militaires, art. L61 ; décret n° 2010-1749 (retenue 11,10 % depuis 2020)',
};
const RAFP = {
  label:
    'Décret n° 2004-569 (RAFP : 5 % + 5 % sur les primes, dans la limite de 20 % du traitement indiciaire)',
};
const CSG_REMPLACEMENT = {
  label:
    'CSS art. L136-1-2, L136-8 (CSG sur allocations chômage 6,2 % dont 3,8 % déductible, CRDS 0,5 %, écrêtement au SMIC)',
  url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F2971',
};
const HYP = { label: 'Hypothèse du simulateur (voir docs/METHODE.md)' };
const CPO_TVA = {
  label: 'CPO, note n° 6 « La TVA est-elle un impôt juste ? » (sept. 2023)',
  url: 'https://www.ccomptes.fr/sites/default/files/2023-10/20230928-TVA-est-elle-impot-juste.pdf',
};
const INSEE_TVA = {
  label:
    'INSEE, Économie et Statistique n° 522-523 (2021), André & Biotteau (structure de consommation par taux)',
  url: 'https://www.insee.fr/fr/statistiques/fichier/5347200/01-ES522-523_Andre-Biotteau_FR.pdf',
};

export const EXTRA_PARAMS = {
  'x.apec_employer': {
    value: 0.00036,
    unit: 'rate on 0..4 PMSS (cadres)',
    effective: '2026-01-01',
    source: URSSAF_2026,
    status: 'official_republished',
  },

  'x.fp.retenue_pension': {
    value: 0.111,
    unit: 'rate on traitement indiciaire brut',
    effective: '2020-01-01',
    source: PCMR,
    status: 'official',
  },
  'x.fp.rafp': {
    value: 0.05,
    unit: 'rate on primes (employee and employer each)',
    effective: '2005-01-01',
    source: RAFP,
    status: 'official',
  },
  'x.fp.rafp_cap_share_of_tib': {
    value: 0.2,
    unit: 'share of traitement indiciaire',
    effective: '2005-01-01',
    source: RAFP,
    status: 'official',
  },
  'x.fp.primes_share': {
    value: 0.2,
    unit: 'share of gross pay made of primes (assumed)',
    effective: '2026-01-01',
    source: HYP,
    status: 'hypothesis',
  },
  'x.fp.employer_pension': {
    value: 0.3765,
    unit: 'rate on traitement indiciaire (CNRACL 2026)',
    effective: '2026-01-01',
    source: CNRACL,
    status: 'approximation',
  },
  'x.fp.employer_maladie': {
    value: 0.0988,
    unit: 'rate on traitement indiciaire',
    effective: '2026-01-01',
    source: {
      label:
        'Cotisation maladie employeur fonction publique (CNRACL / employeurs territoriaux et hospitaliers) 9,88 %',
    },
    status: 'approximation',
  },
  'x.fp.employer_af': {
    value: 0.0525,
    unit: 'rate on gross',
    effective: '2026-01-01',
    source: URSSAF_2026,
    status: 'approximation',
  },
  'x.fp.employer_csa_fnal': {
    value: 0.004,
    unit: 'rate on gross (CSA 0,3 % + FNAL 0,1 %)',
    effective: '2026-01-01',
    source: URSSAF_2026,
    status: 'approximation',
  },

  'x.are.csg_rate': {
    value: 0.062,
    unit: 'rate on 98,25 % of ARE',
    effective: '2019-01-01',
    source: CSG_REMPLACEMENT,
    status: 'official',
  },
  'x.are.csg_deductible': {
    value: 0.038,
    unit: 'rate on 98,25 % of ARE',
    effective: '2019-01-01',
    source: CSG_REMPLACEMENT,
    status: 'official',
  },
  'x.are.crds': {
    value: 0.005,
    unit: 'rate on 98,25 % of ARE',
    effective: '1996-02-01',
    source: CSG_REMPLACEMENT,
    status: 'official',
  },

  'x.aeeh.base_rate': {
    value: 0.32,
    unit: 'BMAF share per child (153,01 €)',
    effective: '2026-04-01',
    source: {
      label: 'AEEH de base : 32 % de la BMAF (CSS art. L541-1, D541-1)',
      url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F14809',
    },
    status: 'official',
  },
  'x.aah.min_age': {
    value: 20,
    unit: 'years',
    effective: '2026-01-01',
    source: {
      label: 'AAH : à partir de 20 ans',
      url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F12242',
    },
    status: 'official',
  },
  'x.aah.age_limit_50_79': {
    value: 62,
    unit: 'years (approx. âge légal de départ ; AAH 50-79 % stops)',
    effective: '2026-01-01',
    source: {
      label:
        "AAH (taux 50-79 %) : versée jusqu'à l'âge légal de départ en retraite (simplifié à 62 ans)",
      url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F12242',
    },
    status: 'approximation',
  },
  'x.pa.student_min_earnings_share_of_smic_net': {
    value: 0.78,
    unit: 'share of net SMIC',
    effective: '2016-01-01',
    source: {
      label: "CSS art. L842-2 (étudiants et apprentis : revenus d'activité ≥ 78 % du SMIC)",
      url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F2882',
    },
    status: 'approximation',
  },
  'x.pa.min_age': {
    value: 18,
    unit: 'years',
    effective: '2016-01-01',
    source: {
      label: 'Prime d’activité : à partir de 18 ans',
      url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F2882',
    },
    status: 'official',
  },

  'x.dons.rate': {
    value: 0.66,
    unit: 'rate (réduction d’impôt)',
    effective: '2026-01-01',
    source: { label: 'CGI art. 200 (66 % des dons, dans la limite de 20 % du revenu imposable)' },
    status: 'official',
  },
  'x.dons.cap_share_of_income': {
    value: 0.2,
    unit: 'share of revenu imposable',
    effective: '2026-01-01',
    source: { label: 'CGI art. 200' },
    status: 'official',
  },
  'x.emploi_domicile.rate': {
    value: 0.5,
    unit: 'rate (crédit d’impôt)',
    effective: '2026-01-01',
    source: {
      label:
        'CGI art. 199 sexdecies (crédit 50 %, plafond 12 000 € + 1 500 € par enfant à charge ou membre ≥ 65 ans, max 15 000 €)',
      url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F12',
    },
    status: 'official',
  },
  'x.emploi_domicile.cap_base': {
    value: 12000,
    unit: 'EUR/year',
    effective: '2026-01-01',
    source: {
      label: 'CGI art. 199 sexdecies',
      url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F12',
    },
    status: 'official',
  },
  'x.emploi_domicile.cap_increment': {
    value: 1500,
    unit: 'EUR/year per dependent child or member aged 65+',
    effective: '2026-01-01',
    source: {
      label: 'CGI art. 199 sexdecies',
      url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F12',
    },
    status: 'official',
  },
  'x.emploi_domicile.cap_max': {
    value: 15000,
    unit: 'EUR/year',
    effective: '2026-01-01',
    source: {
      label: 'CGI art. 199 sexdecies',
      url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F12',
    },
    status: 'official',
  },

  // ---- TVA: smooth fixed-basket estimate (VISION H5) ------------------------------------------------------
  'x.tva.propensity_low': {
    value: 0.97,
    unit: 'consumption / disposable income, lowest incomes (D1-D2)',
    effective: '2017',
    source: CPO_TVA,
    status: 'official_republished',
  },
  'x.tva.propensity_high': {
    value: 0.72,
    unit: 'consumption / disposable income, highest incomes (D9-D10)',
    effective: '2017',
    source: CPO_TVA,
    status: 'official_republished',
  },
  'x.tva.nv_mid': {
    value: 25760,
    unit: 'EUR/year per UC (median niveau de vie 2023, centre of the smooth curves)',
    effective: '2023',
    source: {
      label: 'INSEE Première n° 2063 (niveau de vie médian 2023)',
      url: 'https://www.insee.fr/fr/statistiques/8612538',
    },
    status: 'official',
  },
  'x.tva.propensity_steepness': {
    value: 4,
    unit: 'exponent of the logistic in log(niveau de vie)',
    effective: '2026',
    source: HYP,
    status: 'hypothesis',
  },
  'x.tva.share_normal': {
    value: 0.522,
    unit: 'share of consumption at 20 % (national, 2016)',
    effective: '2016',
    source: INSEE_TVA,
    status: 'official_republished',
  },
  'x.tva.share_intermediate': {
    value: 0.133,
    unit: 'share of consumption at 10 %',
    effective: '2016',
    source: INSEE_TVA,
    status: 'official_republished',
  },
  'x.tva.share_reduced': {
    value: 0.154,
    unit: 'share of consumption at 5,5 %',
    effective: '2016',
    source: INSEE_TVA,
    status: 'official_republished',
  },
  'x.tva.share_particular': {
    value: 0.006,
    unit: 'share of consumption at 2,1 %',
    effective: '2016',
    source: INSEE_TVA,
    status: 'official_republished',
  },
  'x.tva.reduced_tilt': {
    value: 0.25,
    unit: 'max relative deviation of the 5,5 % share (poorest +25 %, richest −25 %)',
    effective: '2026',
    source: {
      label:
        'Hypothèse calibrée sur INSEE Budget de famille 2017 (part de l’alimentation décroissante avec le revenu)',
    },
    status: 'hypothesis',
  },
  'x.tva.intermediate_tilt': {
    value: -0.1,
    unit: 'max relative deviation of the 10 % share (poorest −10 %, richest +10 %)',
    effective: '2026',
    source: {
      label:
        'Hypothèse calibrée sur INSEE Budget de famille 2017 (restauration, transports, travaux croissants avec le revenu)',
    },
    status: 'hypothesis',
  },
  'x.tva.food_share_of_reduced': {
    value: 0.85,
    unit: 'share of the 5,5 % basket that is food (slow path 10/15/20 %)',
    effective: '2026',
    source: HYP,
    status: 'hypothesis',
  },
  'x.tva.niche_share_of_nonfood_gap': {
    value: 0.25,
    unit: 'share of non-food reduced-rate VAT counted as niches (abolished 1 Jul 2027)',
    effective: '2026',
    source: {
      label:
        'Classeur « Synthèse Chiffres », onglet Détail Niches : taux réduits niches 9,9 Md€ vs taux réduits non comptabilisés 33,4 Md€ (arrondi)',
    },
    status: 'hypothesis',
  },

  // ---- CEE (certificats d'économies d'énergie), abrogated 1 Jul 2027 ---------------------------------------
  'x.cee.cost_annual': {
    value: 6e9,
    unit: 'EUR/year passed through energy bills',
    effective: '2024',
    source: { label: 'Cour des comptes (coût des CEE ≈ 6 Md€/an), cité par l’amendement PLF-P1' },
    status: 'official_republished',
  },
  'x.cee.households': {
    value: 30e6,
    unit: 'households',
    effective: '2026',
    source: {
      label: 'Fiche « Foyer » (30 M foyers)',
      url: 'https://france-resolution.fr/fiches/foyer.html',
    },
    status: 'workbook',
  },
  'x.cee.uc_average': {
    value: 1.5,
    unit: 'consumption units per household (average)',
    effective: '2026',
    source: HYP,
    status: 'hypothesis',
  },
} as const satisfies Record<string, ParamMeta>;

export type ExtraKey = keyof typeof EXTRA_PARAMS;
