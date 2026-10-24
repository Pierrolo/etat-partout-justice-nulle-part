/**
 * Household engine core: one month of flows under given rules, then the year (or steady state) by averaging the
 * months and computing the income tax once on the average taxable income. Shared by the baseline and the plan, so
 * a plan with every switch off reproduces the baseline exactly (invariant 2).
 *
 * Calculation order (baseline-rules.md §1): salary / ARE / pension chains → income tax (pension CSG tier needs the
 * RFR: fixed point) → revenu net catégoriel → family benefits → housing aid → AAH, ASPA → RSA, prime d'activité.
 */
import { aahMonthly } from './baseline/aah.ts';
import { apl } from './baseline/aides-logement.ts';
import { aspaMonthly } from './baseline/aspa.ts';
import { areFromNet, type AreResult } from './baseline/chomage.ts';
import {
  abattementSalaire,
  incomeTax,
  netCategoricalIncome,
  type IncomeTaxResult,
} from './baseline/ir.ts';
import { primeActivite, type PaResult } from './baseline/prime-activite.ts';
import {
  aeehBase,
  allocationsFamiliales,
  ars,
  asf,
  complementFamilial,
  pajeBase,
} from './baseline/prestations-familiales.ts';
import {
  pensionChain,
  pensionTierFor,
  pensionTotalRate,
  type PensionResult,
  type PensionTier,
} from './baseline/retraite.ts';
import { rsa, type RsaResult } from './baseline/rsa.ts';
import { salaryChain, type SalaryResult } from './baseline/salaire.ts';
import type { NHousehold } from './normalize.ts';
import { n } from './params/index.ts';
import { afuOf, type AfuBreakdown } from './plan/afu.ts';
import type { MonthRules, Rules, YearRules } from './plan/periods.ts';

// ------------------------------------------------------------------------------------------------ tax units
export interface Foyer {
  adults: number[];
  couple: boolean;
  children: number[]; // ages
  /** dependent children holding the CMI « invalidité » (½ part each today) */
  childrenCmi: number;
  parentIsole: boolean;
  /** foyer that declares the household's childcare / emploi à domicile / dons expenses */
  main: boolean;
}

export function foyersOf(nh: NHousehold): Foyer[] {
  const ages = nh.children.map((c) => c.age);
  const childrenCmi = nh.children.filter((c) => c.cmiInvalidite).length;
  if (nh.adults.length === 1 || nh.married) {
    return [
      {
        adults: nh.adults.map((a) => a.index),
        couple: nh.adults.length === 2,
        children: ages,
        childrenCmi,
        parentIsole: nh.adults.length === 1 && ages.length > 0,
        main: true,
      },
    ];
  }
  // unmarried couple: two foyers fiscaux, children attached to the first adult; never « parent isolé » (cohabitation)
  return [
    { adults: [0], couple: false, children: ages, childrenCmi, parentIsole: false, main: true },
    { adults: [1], couple: false, children: [], childrenCmi: 0, parentIsole: false, main: false },
  ];
}

// ------------------------------------------------------------------------------------------------ flows
export interface BaselineSnapshot {
  aplGross: number;
  af: number;
  afBase: number;
  cf: number;
  paje: number;
  arsAnnual: number;
  asf: number;
  aeeh: number;
  pensionTiers: PensionTier[];
  pensionGross: number[];
  /** today's annual salary + ARE taxable income per adult (RFR 2026 for the 2028 pension CSG tier) */
  salTaxY: number[];
}

export interface MonthFlows {
  sal: Array<SalaryResult | null>;
  are: Array<AreResult | null>;
  pens: Array<PensionResult | null>;
  /** salary + ARE taxable, annualised, per adult */
  salTaxY: number[];
  pensTaxY: number[];
  rncHousehold: number;
  aplGross: number;
  af: number;
  afBase: number;
  cf: number;
  paje: number;
  arsAnnual: number;
  asf: number;
  aeeh: number;
  aah: number[];
  aspa: number;
  rsa: number;
  pa: number;
  rsaInfo: RsaResult | null;
  paInfo: PaResult | null;
  afuMonthly: number;
  /** maintained benefits (H1 differential) taxable at 23 %, annualised */
  maintainedY: number;
}

export interface MonthContext {
  nh: NHousehold;
  rules: MonthRules;
  year: YearRules;
  base: BaselineSnapshot | null;
  afu: AfuBreakdown;
}

function pensionGrossFor(
  nh: NHousehold,
  i: number,
  tier: PensionTier,
  base: BaselineSnapshot | null,
): number {
  const p = nh.adults[i]!.pension;
  if (!p || p.amount <= 0) return 0;
  if (base) return base.pensionGross[i] ?? 0;
  return p.basis === 'brut' ? p.amount : p.amount / (1 - pensionTotalRate(tier));
}

/** Annual income tax of one foyer under the barème regime. */
export function irBareme(
  nh: NHousehold,
  f: Foyer,
  salTaxY: number[],
  pensTaxY: number[],
  y: YearRules,
): IncomeTaxResult & { rnc: number } {
  const rnc = netCategoricalIncome(
    f.adults.map((i) => salTaxY[i] ?? 0),
    f.adults.map((i) => pensTaxY[i] ?? 0),
    y.pensionAbattement,
  );
  const credits = creditsOf(nh, f, y, rnc);
  const t = incomeTax({
    rnc,
    couple: f.couple,
    nChildren: f.children.length,
    parentIsole: f.parentIsole,
    anyoneAged65: f.adults.some((i) => nh.adults[i]!.age >= 65),
    // CGI 157 bis: per person aged ≥ 65 or holding the CMI « invalidité » (aah_80), doubled for a couple
    abattement157bisPersons: f.adults.filter(
      (i) => nh.adults[i]!.age >= 65 || nh.adults[i]!.disability === 'aah_80',
    ).length,
    invalidHalfParts:
      f.adults.filter((i) => nh.adults[i]!.disability === 'aah_80').length + f.childrenCmi,
    refundableCredits: credits.garde + credits.emploiDomicile,
    reductionDons: credits.dons,
  });
  return { ...t, rnc };
}

export interface Credits {
  garde: number;
  emploiDomicile: number;
  /** before the cap at the tax due */
  dons: number;
}

/** Annual tax credits / reductions of a foyer (garde d'enfants < 6 ans hors domicile, emploi à domicile, dons). */
export function creditsOf(nh: NHousehold, f: Foyer, y: YearRules, taxableIncome: number): Credits {
  if (!f.main) return { garde: 0, emploiDomicile: 0, dons: 0 };
  let garde = 0;
  const under6 = f.children.filter((a) => a < 6).length;
  if (
    (nh.childcare === 'creche' || nh.childcare === 'assistante_maternelle') &&
    nh.childcareCostMonthly > 0 &&
    under6 > 0
  ) {
    const perChild = (12 * nh.childcareCostMonthly) / under6;
    garde =
      n('income_tax.garde_enfant_credit_rate') *
      Math.min(perChild, n('income_tax.garde_enfant_credit_expense_cap')) *
      under6 *
      y.credits.garde;
  }
  let emploiDomicile = 0;
  if (nh.emploiDomicileAnnual > 0) {
    const members65 = nh.adults.filter((a) => a.age >= 65).length;
    const cap = Math.min(
      n('x.emploi_domicile.cap_max'),
      n('x.emploi_domicile.cap_base') +
        n('x.emploi_domicile.cap_increment') * (f.children.length + members65),
    );
    emploiDomicile =
      n('x.emploi_domicile.rate') *
      Math.min(nh.emploiDomicileAnnual, cap) *
      y.credits.emploiDomicile;
  }
  let dons = 0;
  if (nh.donsAnnual > 0)
    dons =
      n('x.dons.rate') *
      Math.min(nh.donsAnnual, n('x.dons.cap_share_of_income') * Math.max(0, taxableIncome)) *
      y.credits.dons;
  return { garde, emploiDomicile, dons };
}

/** Taxable base of the flat regime (annual), per adult, without maintained benefits. */
export function flatBasePerAdult(
  salTaxY: number[],
  pensTaxY: number[],
  fraisPro: boolean,
): number[] {
  return salTaxY.map((s, i) => s - (fraisPro ? abattementSalaire(s) : 0) + (pensTaxY[i] ?? 0));
}

export function computeMonth(ctx: MonthContext): MonthFlows {
  const { nh, rules: m, year: y, base, afu } = ctx;
  const nA = nh.adults.length;
  const ages = nh.children.map((c) => c.age);
  const nK = ages.length;

  const sal = nh.adults.map((a) =>
    a.salary ? salaryChain(a.salary.gross, a.salary.status, a.salary.workRatio, m.csg) : null,
  );
  const are = nh.adults.map((a) => (a.areNet > 0 ? areFromNet(a.areNet) : null));
  const salTaxY = nh.adults.map((_, i) => 12 * ((sal[i]?.taxable ?? 0) + (are[i]?.taxable ?? 0)));
  const foyers = foyersOf(nh);

  // ---- pensions: CSG tier depends on the RFR (fixed point, as scripts/baseline_reference.py) ------------
  let tiers: PensionTier[] = nh.adults.map(() => 'zero');
  let pens: Array<PensionResult | null> = [];
  let pensTaxY: number[] = [];
  const hasPension = nh.adults.some((a) => a.pension && a.pension.amount > 0);
  const buildPensions = () => {
    pens = nh.adults.map((a, i) =>
      a.pension && a.pension.amount > 0
        ? pensionChain(pensionGrossFor(nh, i, tiers[i]!, base), tiers[i]!)
        : null,
    );
    pensTaxY = pens.map((p) => 12 * (p?.taxable ?? 0));
  };
  if (!hasPension) buildPensions();
  else if (m.pensionTier === 'frozen' && base) {
    tiers = [...base.pensionTiers];
    buildPensions();
  } else {
    // 2028: the CSG rate follows the RFR of 2026 incomes — today's barème and salaries, no 10 % pension abattement
    const rfr2026 = m.pensionTier === 'rfr2026' && base !== null;
    const yT: YearRules = rfr2026
      ? { ir: 'bareme', pensionAbattement: false, fraisPro: true, credits: y.credits }
      : y;
    const salT = rfr2026 ? base.salTaxY : salTaxY;
    for (let it = 0; it < 6; it++) {
      buildPensions();
      const next: PensionTier[] = [...tiers];
      if (yT.ir === 'bareme') {
        for (const f of foyers) {
          const t = irBareme(nh, f, salT, pensTaxY, yT);
          for (const i of f.adults) next[i] = pensionTierFor(t.rfr, t.parts);
        }
      } else {
        const rfr = flatBasePerAdult(salTaxY, pensTaxY, y.fraisPro).reduce((s, x) => s + x, 0);
        const parts = nA + 0.5 * nK;
        for (let i = 0; i < nA; i++) next[i] = pensionTierFor(rfr, parts);
      }
      const stable = next.every((t, i) => t === tiers[i]);
      tiers = next;
      if (stable && it > 0) break;
    }
    buildPensions();
  }

  // ---- revenu net catégoriel of the household (CAF resources, N-2 = current in steady state) -----------------
  const rncHousehold = foyers.reduce(
    (s, f) =>
      s +
      netCategoricalIncome(
        f.adults.map((i) => salTaxY[i] ?? 0),
        f.adults.map((i) => pensTaxY[i] ?? 0),
        y.pensionAbattement,
      ),
    0,
  );

  // ---- family benefits ---------------------------------------------------------------------------------------
  const isolated = nA === 1 && nK > 0;
  const twoIncomes = nA === 2 && salTaxY.filter((s) => s > 0).length >= 2;
  const bonus = twoIncomes || isolated;
  let af = 0,
    afBase = 0,
    cf = 0,
    paje = 0,
    arsAnnual = 0,
    asfAmt = 0,
    aeeh = 0;
  if (m.family === 'computed') {
    const under20 = ages.filter((a) => a < n('benefits.family.af_max_child_age'));
    const afr = allocationsFamiliales(under20, rncHousehold);
    af = afr.af;
    afBase = afr.afBase;
    cf = complementFamilial(ages, rncHousehold, bonus);
    paje = pajeBase(ages, rncHousehold, bonus);
    arsAnnual = ars(ages, rncHousehold);
    asfAmt = isolated ? asf(under20.length) : 0;
    aeeh = aeehBase(nh.children.filter((c) => c.aeeh && c.age < 20).length);
  } else if (m.family === 'frozen' && base) {
    ({ af, afBase, cf, paje, arsAnnual, asf: asfAmt, aeeh } = base);
  }

  // ---- housing aid ---------------------------------------------------------------------------------------------
  let aplGross = 0;
  if (nh.housing.status === 'locataire') {
    if (m.apl.mode === 'computed')
      aplGross = apl(
        nh.housing.zone,
        nA === 2,
        ages.filter((a) => a < 21).length,
        nh.housing.rent,
        rncHousehold,
      ).gross;
    else aplGross = (base?.aplGross ?? 0) * m.apl.factor;
  }

  if (nh.nonRecours) {
    af = afBase = cf = paje = arsAnnual = asfAmt = aeeh = aplGross = 0;
  }

  // ---- AFU ---------------------------------------------------------------------------------------------------
  const afuMonthly = m.afu ? afu.annual / 12 : 0;

  // ---- minima sociaux: AAH, ASPA, then RSA and prime d'activité --------------------------------------------
  let aah = nh.adults.map(() => 0);
  let aspa = 0,
    rsaAmt = 0,
    paAmt = 0;
  let rsaInfo: RsaResult | null = null;
  let paInfo: PaResult | null = null;
  const pensNet = pens.map((p) => p?.net ?? 0);
  const areNet = are.map((r) => r?.net ?? 0);
  const salNet = sal.map((s) => s?.net ?? 0);
  if (m.minima !== 'replaced' && !nh.nonRecours) {
    const diff = m.minima === 'differential';
    const afuAdult = (i: number) => (diff && m.afu ? (afu.perAdultAnnual[i] ?? 0) / 12 : 0);
    aah = nh.adults.map((a, i) => {
      if (a.disability === 'none' || a.age < n('x.aah.min_age')) return 0;
      if (a.disability === 'aah_50_79' && a.age >= n('x.aah.age_limit_50_79')) return 0;
      const earnings = (sal[i]?.taxable ?? 0) - abattementSalaire(12 * (sal[i]?.taxable ?? 0)) / 12;
      return aahMonthly(earnings, pensNet[i]! + areNet[i]! + afuAdult(i), nK).aah;
    });
    const entitled = nh.adults.filter((a) => a.age >= n('benefits.aspa.min_age')).length;
    if (entitled > 0) {
      const res =
        sum(pensNet) +
        sum(salNet) +
        sum(areNet) +
        sum(aah) +
        nh.adults.reduce((s, _, i) => s + afuAdult(i), 0);
      aspa = aspaMonthly(entitled, nA === 2, res);
    }
    const ownerOrFree = nh.housing.status === 'proprietaire' || nh.housing.status === 'gratuit';
    const majoration =
      isolated &&
      (nh.isolementRecent ||
        Math.min(...ages) < n('benefits.rsa.lone_parent_max_child_age_for_open_ended_majoration'));
    const bmaf = n('general.bmaf');
    const other =
      afBase +
      paje +
      (cf > 0 ? n('benefits.family.cf_rate_base') * bmaf : 0) +
      (asfAmt > 0
        ? n('benefits.family.asf_in_rsa_pa_base_rate') * bmaf * ages.filter((a) => a < 20).length
        : 0) +
      sum(pensNet) +
      aspa +
      sum(aah) +
      sum(areNet) +
      (diff ? afuMonthly : 0);
    const allStudents = nh.adults.every((a) => a.activity === 'etudiant');
    const rsaEligible =
      !allStudents && (nh.adults.some((a) => a.age >= n('benefits.rsa.min_age')) || nK > 0);
    if (rsaEligible) {
      rsaInfo = rsa(nA, nK, sum(salNet), other, aplGross, ownerOrFree, majoration);
      rsaAmt = rsaInfo.rsa;
    }
    const studentMin =
      n('x.pa.student_min_earnings_share_of_smic_net') * n('general.smic_monthly_net_indicative');
    const earnEach = nh.adults
      .map((a, i) => ({ a, e: salNet[i]! }))
      .filter(
        ({ a, e }) =>
          e > 0 && a.age >= n('x.pa.min_age') && (a.activity !== 'etudiant' || e >= studentMin),
      )
      .map(({ e }) => e);
    if (earnEach.length > 0) {
      paInfo = primeActivite(nA, nK, earnEach, other, aplGross, ownerOrFree, majoration);
      paAmt = paInfo.pa;
    }
  }
  const maintainedY = m.minima === 'differential' ? 12 * (rsaAmt + paAmt + sum(aah) + aspa) : 0;

  return {
    sal,
    are,
    pens,
    salTaxY,
    pensTaxY,
    rncHousehold,
    aplGross,
    af,
    afBase,
    cf,
    paje,
    arsAnnual,
    asf: asfAmt,
    aeeh,
    aah,
    aspa,
    rsa: rsaAmt,
    pa: paAmt,
    rsaInfo,
    paInfo,
    afuMonthly,
    maintainedY,
  };
}

function sum(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0);
}

/** Deep average of identically-shaped month flows (numbers averaged, nulls kept, strings from the first month). */
export function averageFlows<T>(items: T[]): T {
  if (items.length === 1) return items[0]!;
  const avg = (vals: unknown[]): unknown => {
    const first = vals[0];
    if (typeof first === 'number') {
      // identical values stay bit-identical (keeps the identity reform exact to the cent)
      if ((vals as number[]).every((x) => x === first)) return first;
      return (vals as number[]).reduce((s, x) => s + x, 0) / vals.length;
    }
    if (Array.isArray(first)) return first.map((_, i) => avg(vals.map((v) => (v as unknown[])[i])));
    if (first === null || first === undefined) {
      const nonNull = vals.find((v) => v !== null && v !== undefined);
      if (nonNull === undefined) return first;
      // a value present only in some months (e.g. a benefit info block): average with zeros for numbers
      return avg(vals.map((v) => (v === null || v === undefined ? zeroLike(nonNull) : v)));
    }
    if (typeof first === 'object') {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(first as object))
        out[k] = avg(vals.map((v) => (v as Record<string, unknown>)[k]));
      return out;
    }
    return first;
  };
  return avg(items as unknown[]) as T;
}

function zeroLike(v: unknown): unknown {
  if (typeof v === 'number') return 0;
  if (Array.isArray(v)) return v.map(zeroLike);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = zeroLike(x);
    return out;
  }
  return v;
}

// ------------------------------------------------------------------------------------------------ scenario
export interface TaxOutcome {
  regime: 'bareme' | 'flat';
  /** annual, positive = paid, before réductions/crédits */
  irGross: number;
  /** annual réductions + crédits (positive = in the household's favour) */
  credits: number;
  creditsDetail: Credits;
  /** annual taxable income shown to the user */
  taxableAnnual: number;
  foyers: Array<IncomeTaxResult & { rnc: number; foyer: Foyer }>;
  /** flat regime details */
  flatBase: number[];
  flatMaintained: number;
}

export interface ScenarioCore {
  flows: MonthFlows;
  tax: TaxOutcome;
  afu: AfuBreakdown;
  afuAnnualPaid: number;
  rules: Rules;
  pensionTiers: PensionTier[];
}

export function runScenario(
  nh: NHousehold,
  rules: Rules,
  base: BaselineSnapshot | null,
): ScenarioCore {
  const afu = afuOf(nh);
  const months = rules.months.map((m) =>
    computeMonth({ nh, rules: m, year: rules.year, base, afu }),
  );
  const flows = averageFlows(months);
  const y = rules.year;
  const foyers = foyersOf(nh);
  let tax: TaxOutcome;
  if (y.ir === 'bareme') {
    const fr = foyers.map((f) => ({
      ...irBareme(nh, f, flows.salTaxY, flows.pensTaxY, y),
      foyer: f,
    }));
    const irGross = fr.reduce((s, t) => s + t.irAfterDecote, 0);
    const credits = fr.reduce((s, t) => s + t.reduction + t.credits, 0);
    const main = fr.find((t) => t.foyer.main)!;
    const cd = creditsOf(nh, main.foyer, y, main.rni);
    tax = {
      regime: 'bareme',
      irGross,
      credits,
      creditsDetail: { garde: cd.garde, emploiDomicile: cd.emploiDomicile, dons: main.reduction },
      taxableAnnual: fr.reduce((s, t) => s + t.rni, 0),
      foyers: fr,
      flatBase: [],
      flatMaintained: 0,
    };
  } else {
    const perAdult = flatBasePerAdult(flows.salTaxY, flows.pensTaxY, y.fraisPro);
    const base0 = perAdult.reduce((s, x) => s + x, 0) + flows.maintainedY;
    const irGross = n('plan.flat_rate') * Math.max(0, base0);
    const allChildren: Foyer = {
      adults: nh.adults.map((a) => a.index),
      couple: false,
      children: nh.children.map((c) => c.age),
      childrenCmi: 0,
      parentIsole: false,
      main: true,
    };
    const cd = creditsOf(nh, allChildren, y, base0);
    const dons = Math.min(cd.dons, irGross);
    tax = {
      regime: 'flat',
      irGross,
      credits: cd.garde + cd.emploiDomicile + dons,
      creditsDetail: { ...cd, dons },
      taxableAnnual: base0,
      foyers: [],
      flatBase: perAdult,
      flatMaintained: flows.maintainedY,
    };
  }
  const afuMonthsPaid = rules.months.filter((m) => m.afu).length / rules.months.length;
  // pension tiers of the last month (for display)
  const lastPens = months[months.length - 1]!.pens;
  return {
    flows,
    tax,
    afu,
    afuAnnualPaid: afu.annual * afuMonthsPaid,
    rules,
    pensionTiers: lastPens.map((p) => p?.tier ?? 'zero'),
  };
}

export function snapshotOf(core: ScenarioCore): BaselineSnapshot {
  const f = core.flows;
  return {
    aplGross: f.aplGross,
    af: f.af,
    afBase: f.afBase,
    cf: f.cf,
    paje: f.paje,
    arsAnnual: f.arsAnnual,
    asf: f.asf,
    aeeh: f.aeeh,
    pensionTiers: core.pensionTiers,
    pensionGross: f.pens.map((p) => p?.gross ?? 0),
    salTaxY: [...f.salTaxY],
  };
}
