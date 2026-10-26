/**
 * simulate(): household → ScenarioResult with one Component per stable id, each with a formula rendered with the
 * household's own numbers, its sources and its tier. Amounts are rounded to the cent component by component and
 * `disposable` is the sum of the rounded amounts (invariant 1 holds exactly).
 */
import { TIER_LABEL } from './baseline/retraite.ts';
import {
  ceeGain,
  consumptionUnits,
  makeBasket,
  tvaExtraCost,
  tvaToday,
  type Basket,
} from './baseline/tva.ts';
import { cmgActivityOk, runScenario, snapshotOf, type ScenarioCore } from './core.ts';
import { eur, eur0, pct, r2 } from './fmt.ts';
import { resolveHypotheses } from './hypotheses.ts';
import { normalize, type NHousehold } from './normalize.ts';
import { n, src, type ParamKey } from './params/index.ts';
import {
  MANIFESTE,
  SRC_AM1_NICHES,
  SRC_AM21_TVA,
  SRC_AM28,
  SRC_AM3_DONS,
  SRC_CEE,
  SRC_P2_32_APL,
  SRC_PLFSS1_CSG,
  SRC_PLFSS7_PF,
} from './params/plan.ts';
import { BASELINE_RULES, planRules, type Rules } from './plan/periods.ts';
import {
  COMPONENT_IDS,
  type Component,
  type ComponentGroup,
  type ComponentId,
  type Household,
  type Hypotheses,
  type Period,
  type ScenarioResult,
  type SimulateOptions,
  type SourceRef,
  type Tier,
} from './types.ts';

export const COMPONENT_META: Record<ComponentId, { label: string; group: ComponentGroup }> = {
  salaire_net: { label: 'Salaire net', group: 'revenus' },
  are: { label: 'Allocation chômage (ARE)', group: 'revenus' },
  pension_nette: { label: 'Pension de retraite nette', group: 'revenus' },
  impot_revenu: { label: 'Impôt sur le revenu', group: 'prelevements' },
  credits_impot: {
    label: "Réductions et crédits d'impôt (garde, emploi à domicile, dons)",
    group: 'prelevements',
  },
  afu: { label: 'Aide fondamentale universelle (AFU)', group: 'prelevements' },
  rsa: { label: 'RSA', group: 'prestations' },
  prime_activite: { label: "Prime d'activité", group: 'prestations' },
  aides_logement: { label: 'Aides au logement (APL/AL)', group: 'prestations' },
  allocations_familiales: { label: 'Allocations familiales', group: 'prestations' },
  complement_familial: { label: 'Complément familial', group: 'prestations' },
  paje_base: { label: 'PAJE — allocation de base', group: 'prestations' },
  cmg: {
    label: 'Complément de libre choix du mode de garde (CMG)',
    group: 'prestations',
  },
  ars: { label: 'Allocation de rentrée scolaire (lissée sur 12 mois)', group: 'prestations' },
  asf: { label: 'Allocation de soutien familial', group: 'prestations' },
  aeeh: { label: "Allocation d'éducation de l'enfant handicapé (base)", group: 'prestations' },
  aah: { label: 'Allocation aux adultes handicapés (AAH)', group: 'prestations' },
  aspa: { label: 'Minimum vieillesse (ASPA)', group: 'prestations' },
  aides_caf_declarees: { label: 'Aides CAF (montant déclaré)', group: 'prestations' },
  tva: { label: 'TVA payée (estimation)', group: 'impots_indirects' },
  cee: {
    label: "Fin des certificats d'économies d'énergie (prix de l'énergie)",
    group: 'impots_indirects',
  },
};

const CAF_IDS: ComponentId[] = [
  'rsa',
  'prime_activite',
  'aides_logement',
  'allocations_familiales',
  'complement_familial',
  'paje_base',
  'cmg',
  'ars',
  'asf',
  'aeeh',
  'aah',
];

export interface Evaluated {
  nh: NHousehold;
  hyp: Hypotheses;
  period: Period;
  baseline: ScenarioResult;
  baselineCore: ScenarioCore;
  basket: Basket;
  plan?: ScenarioResult;
  planCore?: ScenarioCore;
}

type Draft = { amount: number; formula: string; sources: SourceRef[]; tier: Tier };

function draftsZero(): Record<ComponentId, Draft> {
  const out = {} as Record<ComponentId, Draft>;
  for (const id of COMPONENT_IDS) out[id] = { amount: 0, formula: '—', sources: [], tier: 'law' };
  return out;
}

const who = (nh: NHousehold, i: number) => (nh.adults.length > 1 ? `Adulte ${i + 1} : ` : '');
const CRDS = n('general.crds_rate');

interface BuildCtx {
  nh: NHousehold;
  hyp: Hypotheses;
  scenario: 'baseline' | 'plan';
  period: Period;
  core: ScenarioCore;
  rules: Rules;
  basket: Basket;
  /** for the plan: the baseline core (frozen amounts, CAF override scaling) */
  baselineCore: ScenarioCore | null;
}

function prefix(c: BuildCtx): string {
  if (c.scenario === 'baseline') return '';
  return c.period === 'steady' ? '' : `Moyenne mensuelle ${c.period} : `;
}

function build(c: BuildCtx): ScenarioResult {
  const { nh, core, scenario, rules, hyp } = c;
  const f = core.flows;
  const d = draftsZero();
  const plan = scenario === 'plan';
  const pre = prefix(c);
  const csgRateAvg =
    rules.months.reduce((s, m) => s + m.csg.csg + m.csg.crds, 0) / rules.months.length;
  const allMonths = <K extends keyof (typeof rules.months)[number]>(
    k: K,
    v: (typeof rules.months)[number][K],
  ) => rules.months.every((m) => m[k] === v);
  const anyMonth = (pred: (m: (typeof rules.months)[number]) => boolean) => rules.months.some(pred);

  // ---- revenus ---------------------------------------------------------------------------------------------
  {
    const parts: string[] = [];
    let amt = 0;
    f.sal.forEach((s, i) => {
      if (!s) return;
      amt += s.net;
      const csg = s.csgDed + s.csgNonDed + s.crds;
      const csgTxt =
        csg < 0.005
          ? 'CSG/CRDS 0 € (supprimées sur les revenus d’activité)'
          : `CSG/CRDS ${eur(csg)} (${pct(csgRateAvg)} × 98,25 % du brut)`;
      parts.push(
        `${who(nh, i)}brut ${eur(s.gross)} − cotisations ${eur(s.cotisationsSalariales)} − ${csgTxt} = ${eur(s.net)}${s.status === 'fonctionnaire' ? ' (cotisations fonction publique approchées)' : ''}`,
      );
    });
    const sources = src('salary.employee.vieillesse_plafonnee', 'salary.csg_crds.csg_total');
    if (nh.adults.some((a) => a.salary?.status === 'fonctionnaire'))
      sources.push(...src('x.fp.retenue_pension', 'x.fp.primes_share'));
    if (plan && csgRateAvg < CSG_TODAY_TOTAL - 1e-9) sources.unshift(SRC_PLFSS1_CSG);
    d.salaire_net = {
      amount: amt,
      formula: parts.length ? pre + parts.join(' ; ') : 'Pas de salaire.',
      sources,
      tier: 'law',
    };
  }
  {
    const parts: string[] = [];
    let amt = 0;
    f.are.forEach((r, i) => {
      if (!r) return;
      amt += r.net;
      parts.push(
        `${who(nh, i)}ARE nette ${eur(r.net)} (brute ${eur(r.gross)}, CSG/CRDS ${eur(r.csg + r.crds)}${r.csg + r.crds < 0.005 ? ' : exonérée car l’allocation est inférieure au SMIC brut' : ''})`,
      );
    });
    d.are = {
      amount: amt,
      formula: parts.length
        ? parts.join(' ; ') +
          (plan
            ? ' — montant inchangé par le plan (H6), CSG maintenue sur les revenus de remplacement'
            : '')
        : 'Pas d’allocation chômage.',
      sources: plan ? [...src('x.are.csg_rate'), SRC_PLFSS1_CSG] : src('x.are.csg_rate'),
      tier: plan ? 'hypothesis' : 'law',
    };
  }
  {
    const parts: string[] = [];
    let amt = 0;
    f.pens.forEach((p, i) => {
      if (!p) return;
      amt += p.net;
      const rate = p.gross > 0 ? (p.gross - p.net) / p.gross : 0;
      parts.push(
        `${who(nh, i)}pension brute ${eur(p.gross)} − CSG/CRDS/CASA ${eur(p.gross - p.net)} (${pct(rate)}, ${TIER_LABEL[core.pensionTiers[i] ?? 'zero']}) = ${eur(p.net)}`,
      );
    });
    const tierNote = plan
      ? rules.months.every((m) => m.pensionTier === 'frozen')
        ? ' — taux de CSG fixé sur le RFR N-2 (inchangé)'
        : rules.months.every((m) => m.pensionTier === 'rfr2026')
          ? ' — taux de CSG fixé sur le RFR 2026 (N-2), calculé sans l’abattement de 10 % sur les pensions'
          : ' — taux de CSG recalculé sur le revenu imposable du plan (1 part par adulte + ½ par enfant, art. 194 abrogé : hypothèse)'
      : '';
    d.pension_nette = {
      amount: amt,
      formula: parts.length ? parts.join(' ; ') + tierNote : 'Pas de pension.',
      sources: src('pensions.csg_rate_full', 'pensions.csg_rfr_thresholds_1_part'),
      tier: 'law',
    };
  }

  // ---- impôt sur le revenu ---------------------------------------------------------------------------------
  const t = core.tax;
  if (t.regime === 'bareme') {
    const parts = t.foyers.map((fo, k) => {
      const lbl =
        t.foyers.length > 1
          ? `Foyer fiscal ${k + 1} (adulte ${fo.foyer.adults[0]! + 1}${fo.foyer.children.length ? ' + enfants' : ''}) : `
          : '';
      const ab =
        fo.ageAbattement > 0
          ? ` − abattement âge ou invalidité (art. 157 bis) ${eur0(fo.ageAbattement)}`
          : '';
      const dec = fo.decote > 0 ? ` − décote ${eur0(fo.decote)}` : '';
      return `${lbl}revenu net imposable ${eur0(fo.rnc)}${ab}, ${String(fo.parts).replace('.', ',')} part${fo.parts > 1 ? 's' : ''} → impôt ${eur0(fo.irBeforeDecote)}${dec} = ${eur0(fo.irAfterDecote)}/an`;
    });
    const note =
      plan && !rules.year.pensionAbattement && core.flows.pens.some((p) => p)
        ? ' (abattement de 10 % sur les pensions supprimé dès l’IR sur les revenus 2026)'
        : '';
    d.impot_revenu = {
      amount: -t.irGross / 12,
      formula: `${pre}Barème 2026 : ${parts.join(' ; ')}${note} ; ÷ 12 = ${eur(t.irGross / 12)}/mois`,
      sources:
        plan && !rules.year.pensionAbattement
          ? [...src('income_tax.bareme_2026', 'income_tax.decote_single'), SRC_AM1_NICHES]
          : src(
              'income_tax.bareme_2026',
              'income_tax.decote_single',
              'income_tax.qf_cap_per_half_part',
            ),
      tier: 'law',
    };
  } else {
    const parts: string[] = [];
    f.salTaxY.forEach((s, i) => {
      const pTax = f.pensTaxY[i] ?? 0;
      if (s <= 0 && pTax <= 0) return;
      const bits: string[] = [];
      if (s > 0) {
        const fp = rules.year.fraisPro ? s - (t.flatBase[i]! - pTax) : 0;
        bits.push(
          rules.year.fraisPro
            ? `salaires/ARE ${eur0(s)} − 10 % frais professionnels ${eur0(fp)}`
            : `salaires/ARE ${eur0(s)} (sans déduction de 10 % : H2 désactivée)`,
        );
      }
      if (pTax > 0)
        bits.push(`pensions ${eur0(pTax)} (après CSG déductible, sans abattement de 10 %)`);
      parts.push(`${who(nh, i)}${bits.join(' + ')}`);
    });
    if (t.flatMaintained > 0)
      parts.push(`aides maintenues en différentiel ${eur0(t.flatMaintained)} (imposables, H1)`);
    d.impot_revenu = {
      amount: -t.irGross / 12,
      formula: `${pre}23 % × revenu net imposable ${eur0(t.taxableAnnual)}/an${parts.length ? ` (${parts.join(' ; ')})` : ''} = ${eur0(t.irGross)}/an ; ÷ 12 = ${eur(t.irGross / 12)}/mois (ni quotient familial ni décote)`,
      sources: [SRC_AM28, ...(rules.year.fraisPro ? src('plan.frais_pro_10_kept') : [])],
      tier: 'law',
    };
  }
  {
    const cd = t.creditsDetail;
    const bits: string[] = [];
    if (cd.garde > 0)
      bits.push(
        `garde d’enfants < 6 ans ${eur0(cd.garde)}/an (50 % des frais ${eur0(12 * f.childcareCost)}/an${f.cmg > 0 ? ` diminués du CMG ${eur0(12 * f.cmg)}/an` : ''}, plafond 3 500 € par enfant)`,
      );
    if (cd.emploiDomicile > 0) bits.push(`emploi à domicile ${eur0(cd.emploiDomicile)}/an`);
    if (cd.dons > 0) bits.push(`réduction pour dons ${eur0(cd.dons)}/an`);
    const hadExpenses = f.childcareCost > 0 || nh.emploiDomicileAnnual > 0 || nh.donsAnnual > 0;
    const factors = rules.year.credits;
    const phase =
      plan && hadExpenses && (factors.garde < 1 || factors.dons < 1)
        ? ` — niches réduites par le plan (part conservée : garde/emploi à domicile ${pct(factors.garde)}, dons ${pct(factors.dons)})`
        : '';
    d.credits_impot = {
      amount: t.credits / 12,
      formula: bits.length
        ? `${pre}${bits.join(' + ')}${phase} ; ÷ 12`
        : hadExpenses
          ? `Aucun crédit ni réduction${phase}.`
          : 'Aucune dépense ouvrant droit à crédit ou réduction d’impôt.',
      sources: plan
        ? [SRC_AM1_NICHES, SRC_AM3_DONS]
        : src('income_tax.garde_enfant_credit_rate', 'x.emploi_domicile.rate', 'x.dons.rate'),
      tier: 'law',
    };
  }
  if (core.afuAnnualPaid > 0) {
    const a = core.afu;
    const bits = [
      `${eur0(n('plan.afu_adult'))} × ${a.nAdultParts} personne${a.nAdultParts > 1 ? 's' : ''} majeure${a.nAdultParts > 1 ? 's' : ''}`,
    ];
    if (a.nChildParts)
      bits.push(
        `${eur0(n('plan.afu_child'))} × ${a.nChildParts} enfant${a.nChildParts > 1 ? 's' : ''}`,
      );
    if (a.nInvalidity)
      bits.push(
        `${eur0(n('plan.afu_invalidity'))} × ${a.nInvalidity} titulaire${a.nInvalidity > 1 ? 's' : ''} CMI invalidité`,
      );
    if (a.nPension)
      bits.push(
        `${eur0(n('plan.afu_pension'))} × ${a.nPension} pension${a.nPension > 1 ? 's' : ''} liquidée${a.nPension > 1 ? 's' : ''} avant 2028`,
      );
    d.afu = {
      amount: core.afuAnnualPaid / 12,
      formula: `${pre}${bits.join(' + ')} = ${eur0(a.annual)}/an ; ÷ 12 = ${eur(a.annual / 12)}/mois (versée même si elle dépasse l’impôt)`,
      sources: [SRC_AM28],
      tier: 'law',
    };
  } else if (plan) {
    d.afu.formula = 'L’aide fondamentale n’entre en vigueur qu’au 1er janvier 2028.';
    d.afu.sources = [SRC_AM28];
  }

  // ---- prestations -----------------------------------------------------------------------------------------
  /** French agreement of the past participle: '' (m. sg.), 'e' (f. sg.), 'es' (f. pl.) */
  const replacedTxt = (what: string, agr: '' | 'e' | 'es' = '') =>
    `${what} remplacé${agr} par l’aide fondamentale (hypothèse H1 « remplacées », annoncé, aucun texte ne l’abroge).`;
  const minimaReplaced = plan && allMonths('minima', 'replaced');
  const minimaDiff = plan && anyMonth((m) => m.minima === 'differential');
  const minimaTier: Tier = !plan
    ? 'law'
    : minimaDiff
      ? 'hypothesis'
      : minimaReplaced || anyMonth((m) => m.minima === 'replaced')
        ? 'announced'
        : 'law';
  const minimaSources = (k: ParamKey): SourceRef[] =>
    plan && minimaTier !== 'law' ? [MANIFESTE, ...src(k)] : src(k);
  const nonRecoursTxt = 'Non perçu (vous avez indiqué ne pas toucher ces aides).';

  {
    const r = f.rsaInfo;
    let formula: string;
    if (nh.nonRecours) formula = nonRecoursTxt;
    else if (minimaReplaced) formula = replacedTxt('RSA');
    else if (r)
      formula = `${pre}montant forfaitaire ${eur(r.socle)} − forfait logement ${eur(r.fl)} − ressources ${eur(r.resources)}${minimaDiff ? ' (dont AFU comptée comme ressource, H1 différentiel)' : ''} = ${eur(f.rsa)}${f.rsa === 0 ? ' (droit nul)' : ''}`;
    else formula = 'Non éligible (moins de 25 ans sans enfant, ou étudiant·e).';
    d.rsa = {
      amount: f.rsa,
      formula,
      sources: minimaSources('benefits.rsa.base_amount_single'),
      tier: minimaTier,
    };
  }
  {
    const p = f.paInfo;
    let formula: string;
    if (nh.nonRecours) formula = nonRecoursTxt;
    else if (minimaReplaced) formula = replacedTxt('Prime d’activité', 'e');
    else if (p)
      formula = `${pre}forfait ${eur(p.forfait)} + bonification ${eur(p.bonification)} + 59,85 % × revenus d’activité ${eur(p.earnings)} − max(revenus + autres ressources ${eur(p.resources)} + forfait logement ${eur(p.fl)} ; forfait) = ${eur(f.pa)}, versée nette de CRDS 0,5 %`;
    else formula = 'Pas de revenus d’activité éligibles.';
    d.prime_activite = {
      amount: f.pa * (1 - CRDS),
      formula,
      sources: minimaSources('benefits.prime_activite.base_amount_single'),
      tier: minimaTier,
    };
  }
  {
    let formula: string;
    let tier: Tier = 'law';
    let sources = src(
      'benefits.housing_apl_private_rented.rent_ceiling_zone2_single',
      'benefits.housing_apl_private_rented.r0_single',
    );
    if (nh.housing.status !== 'locataire')
      formula = 'Non locataire : pas d’aide au logement modélisée.';
    else if (nh.nonRecours) formula = nonRecoursTxt;
    else if (plan && rules.months.some((m) => m.apl.mode === 'frozen')) {
      const factors = rules.months.map((m) => (m.apl.mode === 'frozen' ? m.apl.factor : 1));
      const avgF = factors.reduce((s, x) => s + x, 0) / factors.length;
      formula =
        avgF === 0
          ? 'Supprimée : plus de droit nouveau après le 1er juin 2027 ; droits existants réduits d’un tiers (07/2027), de deux tiers (07/2028) et éteints au 1er juillet 2029 dans le parc conventionné, éteints au terme du bail dans le parc privé ; toutes les aides personnelles au logement abrogées au 1er janvier 2030.'
          : `${pre}montant de décembre 2026 ${eur((c.baselineCore?.flows.aplGross ?? 0) * (1 - CRDS))} × ${pct(avgF)} en moyenne sur l’année (bail en cours ; calendrier du parc conventionné −1/3 au 1er juillet 2027, −2/3 au 1er juillet 2028 ; dans le parc privé l’aide s’arrête au terme du bail, même moyenne pour un bail de 3 ans d’échéance inconnue) = ${eur(f.aplGross * (1 - CRDS))}`;
      sources = [SRC_P2_32_APL];
    } else {
      formula =
        f.aplGross > 0
          ? `${pre}barème APL zone ${nh.housing.zone}, loyer ${eur(nh.housing.rent)}, ressources ${eur0(f.rncHousehold)} → ${eur(f.aplGross)}, net de CRDS 0,5 %`
          : `Loyer ${eur(nh.housing.rent)}, ressources ${eur0(f.rncHousehold)} : droit nul.`;
    }
    if (
      plan &&
      nh.housing.status === 'locataire' &&
      rules.months.some((m) => m.apl.mode === 'frozen')
    )
      tier = 'law';
    d.aides_logement = { amount: f.aplGross * (1 - CRDS), formula, sources, tier };
  }
  const familyAbolished = plan && allMonths('family', 'abolished');
  const famTxt = (what: string, computed: string, agr: '' | 'e' | 'es' = 'e') => {
    if (nh.nonRecours) return nonRecoursTxt;
    if (familyAbolished)
      return `${what} abrogé${agr} au 1er janvier 2028 : l’aide fondamentale « ne se cumule pas avec les prestations familiales ».`;
    if (plan && anyMonth((m) => m.family === 'abolished'))
      return `${pre}${what} versé${agr} jusqu’au 31 décembre 2027 puis abrogé${agr} : ${computed}`;
    return computed;
  };
  const famSources = (k: ParamKey) =>
    plan && anyMonth((m) => m.family === 'abolished') ? [SRC_PLFSS7_PF, SRC_AM28] : src(k);
  const kids = nh.children;
  d.allocations_familiales = {
    amount: f.af * (1 - CRDS),
    formula: famTxt(
      'Allocations familiales',
      f.af > 0
        ? `${kids.filter((k) => k.age < 20).length} enfants de moins de 20 ans, revenu net catégoriel ${eur0(f.rncHousehold)} → ${eur(f.af)}, net de CRDS`
        : 'Moins de deux enfants de moins de 20 ans : pas d’allocations familiales.',
      'es',
    ),
    sources: famSources('benefits.family.af_rate_2_children'),
    tier: 'law',
  };
  d.complement_familial = {
    amount: f.cf * (1 - CRDS),
    formula: famTxt(
      'Complément familial',
      f.cf > 0
        ? `≥ 3 enfants de 3 à 21 ans, ressources ${eur0(f.rncHousehold)} → ${eur(f.cf)}, net de CRDS`
        : 'Non éligible (au moins 3 enfants, tous âgés de 3 ans ou plus, sous plafond).',
      '',
    ),
    sources: famSources('benefits.family.cf_rate_base'),
    tier: 'law',
  };
  d.paje_base = {
    amount: f.paje * (1 - CRDS),
    formula: famTxt(
      'PAJE (allocation de base)',
      f.paje > 0
        ? `enfant(s) de moins de 3 ans → ${eur(f.paje)}, net de CRDS`
        : 'Pas d’enfant de moins de 3 ans sous plafond.',
    ),
    sources: famSources('benefits.family.paje_base_rate_full'),
    tier: 'law',
  };
  {
    const ci = f.cmgInfo;
    let computed: string;
    if (!nh.children.some((k) => k.age < 6)) computed = 'Pas d’enfant de moins de 6 ans.';
    else if (nh.childcare === 'creche')
      computed =
        'Crèche municipale ou associative (PSU) : pas de CMG, la CAF finance directement la crèche.';
    else if (nh.childcare !== 'assistante_maternelle' && nh.childcare !== 'micro_creche')
      computed = 'Pas de garde payante déclarée (assistante maternelle ou micro-crèche).';
    else if (!cmgActivityOk(nh))
      computed =
        'Non éligible : chaque parent doit travailler, être indemnisé·e par France Travail, étudier ou percevoir l’AAH.';
    else if (f.cmg > 0 && !ci)
      computed = `${pre}montant de 2026 (${eur(c.baselineCore?.flows.cmg ?? f.cmg)}) maintenu jusqu’au 31 décembre 2027`;
    else if (f.cmg <= 0 || !ci)
      computed = `Frais de garde ${eur(f.childcareCost)} : droit nul (ressources au-dessus du seuil où l’aide s’annule).`;
    else if (nh.childcare === 'assistante_maternelle')
      computed = `${pre}frais ${eur(f.childcareCost)} (salaire net + indemnités, tarif ≤ 8 €/h) × (1 − ressources ${eur(ci.resources)} × taux d’effort ${String(Math.round(ci.effortRate * 1e6) / 1e4).replace('.', ',')} % ÷ tarif de référence 4,85 €/h) = ${eur(f.cmg)}, net de CRDS (barème linéarisé du 1er septembre 2025 ; cotisations sociales prises en charge en plus par Pajemploi, non comptées)`;
    else
      computed = `${pre}micro-crèche, ressources ${eur0(ci.resources)}/an (tranche ${ci.tier}) : montant par enfant (moitié de 3 à 6 ans), au plus 85 % de la facture ${eur(f.childcareCost)} = ${eur(f.cmg)}, net de CRDS`;
    d.cmg = {
      amount: f.cmg * (1 - CRDS),
      formula: famTxt('Complément de libre choix du mode de garde', computed, ''),
      sources:
        plan && anyMonth((m) => m.family === 'abolished')
          ? [SRC_PLFSS7_PF, SRC_AM28]
          : src(
              ...(nh.childcare === 'micro_creche'
                ? (['x.cmg.structure_amounts_couple'] as const)
                : (['x.cmg.effort_rates', 'x.cmg.max_child_age'] as const)),
            ),
      tier: 'law',
    };
    if (!nh.childcareCostProvided && f.childcareCost > 0)
      d.cmg.formula += ` — frais de garde non renseignés : ${eur(f.childcareCost)}/mois supposés (hypothèse).`;
  }
  d.ars = {
    amount: (f.arsAnnual * (1 - CRDS)) / 12,
    formula: famTxt(
      'Allocation de rentrée scolaire',
      f.arsAnnual > 0
        ? `${eur(f.arsAnnual)} versés en août, net de CRDS, ÷ 12`
        : 'Pas d’enfant de 6 à 18 ans sous plafond.',
    ),
    sources: famSources('benefits.family.ars_rate_6_10'),
    tier: 'law',
  };
  d.asf = {
    amount: f.asf * (1 - CRDS),
    formula: famTxt(
      'Allocation de soutien familial',
      f.asf > 0
        ? nh.childSupport > 0
          ? `parent isolé, 42,2 % BMAF × enfants − pension alimentaire reçue ${eur(nh.childSupport)} (allocation différentielle) = ${eur(f.asf)}, net de CRDS`
          : `parent isolé sans pension alimentaire (hypothèse : aucune pension déclarée), 42,2 % BMAF × enfants = ${eur(f.asf)}, net de CRDS`
        : nh.adults.length === 1 && nh.childSupport > 0 && nh.children.some((k) => k.age < 20)
          ? `Pension alimentaire reçue (${eur(nh.childSupport)}) supérieure ou égale au montant de l’allocation : pas d’ASF.`
          : 'Non éligible (parent isolé sans pension alimentaire, ou pension inférieure à l’allocation).',
    ),
    sources: famSources('benefits.family.asf_rate'),
    tier: 'law',
  };
  d.aeeh = {
    amount: f.aeeh * (1 - CRDS),
    formula: famTxt(
      'AEEH',
      f.aeeh > 0
        ? `AEEH de base 32 % BMAF par enfant = ${eur(f.aeeh)}, net de CRDS (compléments non modélisés)`
        : 'Pas d’enfant bénéficiaire de l’AEEH.',
    ),
    sources: famSources('x.aeeh.base_rate'),
    tier: 'law',
  };
  {
    const amt = f.aah.reduce((s, x) => s + x, 0);
    const disabled = nh.adults.some((a) => a.disability !== 'none');
    let formula: string;
    if (!disabled) formula = 'Pas d’adulte bénéficiaire de l’AAH.';
    else if (nh.nonRecours) formula = nonRecoursTxt;
    else if (minimaReplaced)
      formula =
        replacedTxt('AAH', 'e') +
        (nh.adults.some((a) => a.disability === 'aah_50_79')
          ? ' Le supplément de 6 600 €/an est réservé aux titulaires de la CMI « invalidité » (taux ≥ 80 %).'
          : '');
    else
      formula = f.aah
        .map((x, i) =>
          nh.adults[i]!.disability !== 'none'
            ? `${who(nh, i)}AAH à taux plein ${eur(n('benefits.aah.max_amount'))} − ressources propres${minimaDiff ? ' (dont AFU, H1 différentiel)' : ''} = ${eur(x)}`
            : '',
        )
        .filter(Boolean)
        .join(' ; ');
    d.aah = {
      amount: amt,
      formula: pre && formula !== '—' && !minimaReplaced ? pre + formula : formula,
      sources: minimaSources('benefits.aah.max_amount'),
      tier: disabled ? minimaTier : 'law',
    };
  }
  {
    const old = nh.adults.some((a) => a.age >= n('benefits.aspa.min_age'));
    let formula: string;
    if (!old) formula = 'Aucun adulte de 65 ans ou plus.';
    else if (nh.nonRecours) formula = nonRecoursTxt;
    else if (minimaReplaced) formula = replacedTxt('ASPA', 'e');
    else
      formula =
        f.aspa > 0
          ? `${pre}plafond ${eur(nh.adults.length === 2 ? n('benefits.aspa.max_monthly_couple') : n('benefits.aspa.max_monthly_single'))} − ressources du foyer${minimaDiff ? ' (dont AFU)' : ''} = ${eur(f.aspa)}`
          : 'Ressources au-dessus du minimum vieillesse.';
    d.aspa = {
      amount: f.aspa,
      formula,
      sources: minimaSources('benefits.aspa.max_monthly_single'),
      tier: old ? minimaTier : 'law',
    };
  }

  // ---- CAF override (« total versé chaque mois par la CAF ») ---------------------------------------------
  if (nh.cafOverride !== null && !nh.nonRecours) applyCafOverride(c, d);

  // ---- impôts indirects ----------------------------------------------------------------------------------
  const b = c.basket;
  const tvaBase = tvaToday(b);
  if (hyp.includeTva) {
    const passThrough = hyp.H5_tvaPassThrough;
    const extra = plan
      ? rules.months.reduce((s, m) => s + tvaExtraCost(b, m.tva, passThrough), 0) /
        rules.months.length
      : 0;
    const consTxt = b.userProvided
      ? `consommation déclarée ${eur(b.consumption)}`
      : `consommation estimée ${eur(b.consumption)} (${pct(Math.round(b.propensity * 1000) / 1000)} du revenu disponible actuel)`;
    const rate = b.consumption > 0 ? tvaBase / b.consumption : 0;
    d.tva = {
      amount: -(tvaBase + extra),
      formula:
        `${pre}${consTxt} × taux effectif ${pct(Math.round(rate * 10000) / 10000)} = ${eur(tvaBase)}` +
        (plan
          ? ` + hausse des prix ${eur(extra)} (taux réduits portés à 20 %, alimentation 10 → 15 → 20 % ; répercussion ${pct(passThrough)}, panier fixe)`
          : ' (panier lissé selon le niveau de vie, sources INSEE/CPO)'),
      sources: plan
        ? [SRC_AM21_TVA, SRC_AM1_NICHES, ...src('x.tva.propensity_low', 'x.tva.share_reduced')]
        : src('x.tva.propensity_low', 'x.tva.share_reduced', 'x.tva.reduced_tilt'),
      tier: plan ? 'hypothesis' : 'hypothesis',
    };
    if (plan) {
      const share = rules.months.filter((m) => m.cee).length / rules.months.length;
      const gain = ceeGain(b.uc, passThrough) * share;
      if (share > 0)
        d.cee = {
          amount: gain,
          formula: `${pre}6 Md€/an ÷ 30 M ménages × ${String(Math.round(b.uc * 10) / 10).replace('.', ',')} UC / 1,5 ÷ 12 × répercussion ${pct(passThrough)}${share < 1 ? ` × ${pct(share)} de l’année` : ''} = ${eur(gain)}`,
          sources: [SRC_CEE, ...src('x.cee.cost_annual', 'x.cee.households')],
          tier: 'hypothesis',
        };
    }
  } else {
    d.tva.formula = 'TVA non affichée (option désactivée).';
  }

  // ---- assemble ------------------------------------------------------------------------------------------
  const components: Component[] = COMPONENT_IDS.map((id) => {
    const x = d[id];
    const amount = r2(x.amount) === 0 ? 0 : r2(x.amount);
    return {
      id,
      label: COMPONENT_META[id].label,
      group: COMPONENT_META[id].group,
      amount,
      formula: x.formula,
      sources: x.sources,
      tier: x.tier,
    };
  });
  const disposable = r2(
    components.filter((k) => k.group !== 'impots_indirects').reduce((s, k) => s + k.amount, 0),
  );
  const indirect = components
    .filter((k) => k.group === 'impots_indirects')
    .reduce((s, k) => s + k.amount, 0);
  const perAdult = nh.adults.map((_, i) => {
    const s = f.sal[i];
    return s
      ? {
          gross: r2(s.gross),
          net: r2(s.net),
          employerCost: r2(s.employerCost),
          csgCrds: r2(s.csgDed + s.csgNonDed + s.crds),
          cotisationsSalariales: r2(s.cotisationsSalariales),
          cotisationsPatronales: r2(s.cotisationsPatronales),
        }
      : {
          gross: 0,
          net: 0,
          employerCost: 0,
          csgCrds: 0,
          cotisationsSalariales: 0,
          cotisationsPatronales: 0,
        };
  });
  return {
    disposable,
    disposableAfterTva: r2(disposable + indirect),
    components,
    employerCost: r2(perAdult.reduce((s, p) => s + p.employerCost, 0)),
    perAdult,
    taxableIncomeAnnual: r2(t.taxableAnnual),
  };
}

const CSG_TODAY_TOTAL = n('salary.csg_crds.csg_total') + n('salary.csg_crds.crds');

function applyCafOverride(c: BuildCtx, d: Record<ComponentId, Draft>): void {
  const override = c.nh.cafOverride!;
  // the scale factor is always computed on TODAY's CAF total, then applied to both scenarios
  const baseFlows = (c.baselineCore ?? c.core).flows;
  const todayTotal =
    baseFlows.rsa +
    baseFlows.pa * (1 - CRDS) +
    (baseFlows.aplGross +
      baseFlows.af +
      baseFlows.cf +
      baseFlows.paje +
      baseFlows.asf +
      baseFlows.aeeh +
      baseFlows.cmg) *
      (1 - CRDS) +
    (baseFlows.arsAnnual * (1 - CRDS)) / 12 +
    baseFlows.aah.reduce((s, x) => s + x, 0);
  if (todayTotal > 0.005) {
    const s = override / todayTotal;
    for (const id of CAF_IDS) {
      if (d[id].amount === 0) continue;
      d[id] = {
        ...d[id],
        amount: d[id].amount * s,
        formula: `${d[id].formula} — ajusté × ${String(Math.round(s * 1000) / 1000).replace('.', ',')} pour retrouver le total CAF déclaré (${eur(override)})`,
        tier: 'hypothesis',
      };
    }
  } else {
    const share =
      c.scenario === 'baseline'
        ? 1
        : c.rules.months.filter((m) => m.family !== 'abolished').length / c.rules.months.length;
    d.aides_caf_declarees = {
      amount: override * share,
      formula:
        c.scenario === 'baseline'
          ? `Total CAF déclaré ${eur(override)} (le simulateur ne calcule aucun droit pour votre situation)`
          : share > 0
            ? `${prefix(c)}total CAF déclaré ${eur(override)} supposé maintenu jusqu’au 31 décembre 2027`
            : 'Aides CAF déclarées supposées supprimées avec les prestations familiales et les minima (H1).',
      sources: [{ label: 'Montant déclaré par l’utilisateur' }],
      tier: 'hypothesis',
    };
  }
}

// ------------------------------------------------------------------------------------------------ evaluation
export function evaluate(h: Household, opts: SimulateOptions = {}, withPlan = true): Evaluated {
  const nh = normalize(h);
  const hyp = resolveHypotheses(opts.hypotheses);
  const period: Period =
    opts.period === 2027 || opts.period === 2028 || opts.period === 2030 ? opts.period : 'steady';
  const baselineCore = runScenario(nh, BASELINE_RULES, null);
  const uc = consumptionUnits(
    nh.adults.length,
    nh.children.map((k) => k.age),
  );
  // the basket needs today's disposable income (before TVA): build once without TVA
  const pre = build({
    nh,
    hyp: { ...hyp, includeTva: false },
    scenario: 'baseline',
    period,
    core: baselineCore,
    rules: BASELINE_RULES,
    basket: makeBasket(0, uc, null),
    baselineCore: null,
  });
  const basket = makeBasket(pre.disposable, uc, nh.consumptionMonthly);
  const baseline = build({
    nh,
    hyp,
    scenario: 'baseline',
    period,
    core: baselineCore,
    rules: BASELINE_RULES,
    basket,
    baselineCore: null,
  });
  const out: Evaluated = { nh, hyp, period, baseline, baselineCore, basket };
  if (withPlan) {
    const rules = planRules(period, hyp, opts.__planSwitches);
    const planCore = runScenario(nh, rules, snapshotOf(baselineCore));
    out.planCore = planCore;
    out.plan = build({
      nh,
      hyp,
      scenario: 'plan',
      period,
      core: planCore,
      rules,
      basket,
      baselineCore,
    });
  }
  return out;
}

export function simulate(
  h: Household,
  scenario: 'baseline' | 'plan',
  opts: SimulateOptions = {},
): ScenarioResult {
  const e = evaluate(h, opts, scenario === 'plan');
  return scenario === 'plan' ? e.plan! : e.baseline;
}
