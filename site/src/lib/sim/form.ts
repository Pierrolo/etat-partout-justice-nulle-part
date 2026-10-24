/**
 * Simulator form state ⇄ engine `Household`.
 *
 * The form keeps UI-friendly values (nullable numbers while a field is empty, both adults even when
 * « seul·e », a stable id per child) and `formToHousehold` turns them into a valid `Household` or into
 * friendly French error messages keyed by field. No tax logic here — only input hygiene.
 */
import type {
  Activity,
  Adult,
  Child,
  Disability,
  Household,
  HousingStatus,
  SalaryStatus,
} from '@/lib/engine-types';
import { formatEuro, formatInteger } from '@/lib/format';

/** Net monthly SMIC (full time), 2026: 1 477,93 € (research/baseline/baseline-rules.md). */
export const SMIC_NET_MONTHLY = 1478;

export const LIMITS = {
  adultAge: { min: 18, max: 110 },
  childAge: { min: 0, max: 24 },
  salaryMax: 100_000,
  areMax: 10_000,
  pensionMax: 30_000,
  rentMax: 10_000,
  cafMax: 10_000,
  pensionYear: { min: 1970, max: 2026 },
  moneyAnnualMax: 1_000_000,
} as const;

export interface FormAdult {
  age: number | null;
  activity: Activity;
  salaryAmount: number | null;
  salaryBasis: 'net' | 'brut';
  salaryStatus: SalaryStatus;
  /** 1 = temps plein. */
  workRatio: number;
  areOn: boolean;
  areMonthly: number | null;
  pensionAmount: number | null;
  pensionBasis: 'net' | 'brut';
  pensionStartYear: number | null;
  disability: Disability;
}

export interface FormChild {
  id: string;
  age: number | null;
  aeeh: boolean;
  /** Holds the CMI « invalidité », taux ≥ 80 % (only asked when `aeeh`). The engine's default is NO (the AEEH exists from 50 %). */
  cmi: boolean;
}

export interface FormState {
  couple: boolean;
  marriedOrPacs: boolean;
  adults: [FormAdult, FormAdult];
  children: FormChild[];
  housing: { status: HousingStatus; rentMonthly: number | null; zone: 1 | 2 | 3 };
  nonRecours: boolean;
  /** Lone parent separated less than 18 months ago (RSA / prime d'activité « majoré »). */
  isolementRecent: boolean;
  cafOverrideOn: boolean;
  cafOverrideMonthly: number | null;
  extras: {
    childcare: 'none' | 'parent' | 'creche' | 'assistante_maternelle';
    childcareCostMonthly: number | null;
    emploiDomicileAnnual: number | null;
    donsAnnual: number | null;
    consumptionMonthly: number | null;
  };
}

let childSeq = 0;
export const newChildId = () => `c${++childSeq}`;

export function defaultAdult(overrides: Partial<FormAdult> = {}): FormAdult {
  return {
    age: 35,
    activity: 'salarie',
    salaryAmount: SMIC_NET_MONTHLY,
    salaryBasis: 'net',
    salaryStatus: 'prive',
    workRatio: 1,
    areOn: true,
    areMonthly: 1200,
    pensionAmount: 1600,
    pensionBasis: 'net',
    pensionStartYear: 2020,
    disability: 'none',
    ...overrides,
  };
}

/** The state shown before the person touches anything: one adult, 35, private-sector at SMIC, tenant, zone 2. */
export function defaultFormState(): FormState {
  return {
    couple: false,
    marriedOrPacs: false,
    adults: [defaultAdult(), defaultAdult({ age: 35, salaryAmount: SMIC_NET_MONTHLY })],
    children: [],
    housing: { status: 'locataire', rentMonthly: 600, zone: 2 },
    nonRecours: false,
    isolementRecent: false,
    cafOverrideOn: false,
    cafOverrideMonthly: null,
    extras: {
      childcare: 'none',
      childcareCostMonthly: null,
      emploiDomicileAnnual: null,
      donsAnnual: null,
      consumptionMonthly: null,
    },
  };
}

/* ── Validation ─────────────────────────────────────────────────────────── */

/** Keys: `adult0.age`, `adult1.salary`, `child2.age`, `housing.rent`, `caf`, `extras.childcareCost`… */
export type FieldErrors = Record<string, string>;

const range = (n: number, min: number, max: number) => n >= min && n <= max;
const who = (i: number, couple: boolean) => (!couple ? 'Votre' : i === 0 ? 'Votre' : 'Son');

export function formToHousehold(f: FormState): {
  household: Household | null;
  errors: FieldErrors;
} {
  const errors: FieldErrors = {};
  const count = f.couple ? 2 : 1;
  const adults: Adult[] = [];

  for (let i = 0; i < count; i++) {
    const a = f.adults[i]!;
    const k = `adult${i}`;
    const poss = i === 0 || !f.couple ? 'votre' : 'son';
    const A = who(i, f.couple);
    const adult: Adult = { age: 0, activity: a.activity, disability: a.disability };

    if (a.age === null) {
      errors[`${k}.age`] =
        i === 0 || !f.couple
          ? 'Indiquez votre âge, par exemple 35.'
          : 'Indiquez l’âge de votre conjoint·e, par exemple 35.';
    } else if (!range(a.age, LIMITS.adultAge.min, LIMITS.adultAge.max)) {
      errors[`${k}.age`] =
        `${A} âge doit être compris entre ${LIMITS.adultAge.min} et ${LIMITS.adultAge.max} ans. Pour un mineur, voir le foyer de ses parents.`;
    } else {
      adult.age = a.age;
    }

    if (a.activity === 'salarie') {
      if (a.salaryAmount === null || a.salaryAmount <= 0) {
        errors[`${k}.salary`] =
          `Indiquez ${poss} salaire mensuel (supérieur à 0 €), ou choisissez « Sans emploi ».`;
      } else if (a.salaryAmount > LIMITS.salaryMax) {
        errors[`${k}.salary`] =
          `Ce salaire dépasse ${formatEuro(LIMITS.salaryMax)} par mois : vérifiez que vous n’avez pas saisi un montant annuel.`;
      } else {
        adult.salary = {
          amount: a.salaryAmount,
          basis: a.salaryBasis,
          status: a.salaryStatus,
          ...(a.workRatio < 1 ? { workRatio: a.workRatio } : {}),
        };
      }
    } else if (a.activity === 'chomage' && a.areOn) {
      if (a.areMonthly === null || a.areMonthly <= 0) {
        errors[`${k}.are`] =
          'Indiquez le montant mensuel de l’allocation, ou choisissez « Non indemnisé·e ».';
      } else if (a.areMonthly > LIMITS.areMax) {
        errors[`${k}.are`] =
          `Ce montant dépasse ${formatEuro(LIMITS.areMax)} par mois : vérifiez la saisie.`;
      } else {
        adult.unemployment = { areMonthly: a.areMonthly };
      }
    } else if (a.activity === 'retraite') {
      let ok = true;
      if (a.pensionAmount === null || a.pensionAmount < 0) {
        errors[`${k}.pension`] =
          `Indiquez ${poss} pension mensuelle (0 si elle n’est pas encore versée).`;
        ok = false;
      } else if (a.pensionAmount > LIMITS.pensionMax) {
        errors[`${k}.pension`] =
          `Cette pension dépasse ${formatEuro(LIMITS.pensionMax)} par mois : vérifiez la saisie.`;
        ok = false;
      }
      if (a.pensionStartYear === null) {
        errors[`${k}.pensionYear`] = 'Indiquez l’année de départ à la retraite, par exemple 2019.';
        ok = false;
      } else if (!range(a.pensionStartYear, LIMITS.pensionYear.min, LIMITS.pensionYear.max)) {
        errors[`${k}.pensionYear`] =
          `L’année de départ doit être comprise entre ${LIMITS.pensionYear.min} et ${LIMITS.pensionYear.max}.`;
        ok = false;
      }
      if (ok) {
        adult.pension = {
          amount: a.pensionAmount!,
          basis: a.pensionBasis,
          startYear: a.pensionStartYear!,
        };
      }
    }
    adults.push(adult);
  }

  const children: Child[] = [];
  f.children.forEach((c, i) => {
    if (c.age === null) {
      errors[`child${i}.age`] =
        `Indiquez l’âge de l’enfant ${formatInteger(i + 1)} (0 pour un nourrisson).`;
    } else if (!range(c.age, LIMITS.childAge.min, LIMITS.childAge.max)) {
      errors[`child${i}.age`] =
        `L’âge d’un enfant à charge doit être compris entre ${LIMITS.childAge.min} et ${LIMITS.childAge.max} ans.`;
    } else {
      children.push({
        age: c.age,
        ...(c.aeeh ? { aeeh: true, ...(c.cmi ? { cmiInvalidite: true } : {}) } : {}),
      });
    }
  });

  const housing: Household['housing'] = { status: f.housing.status };
  if (f.housing.status === 'locataire') {
    housing.zone = f.housing.zone;
    if (f.housing.rentMonthly === null) {
      errors['housing.rent'] =
        'Indiquez votre loyer mensuel hors charges (0 si vous ne payez pas de loyer).';
    } else if (f.housing.rentMonthly < 0 || f.housing.rentMonthly > LIMITS.rentMax) {
      errors['housing.rent'] =
        `Le loyer doit être compris entre 0 et ${formatEuro(LIMITS.rentMax)} par mois.`;
    } else {
      housing.rentMonthly = f.housing.rentMonthly;
    }
  } else {
    housing.zone = f.housing.zone;
  }

  const benefits: Household['benefits'] = { nonRecours: f.nonRecours };
  if (f.isolementRecent && !f.couple && f.children.length > 0) benefits.isolementRecent = true;
  if (f.cafOverrideOn && !f.nonRecours) {
    if (f.cafOverrideMonthly === null) {
      errors.caf = 'Indiquez le total versé chaque mois par la CAF, ou décochez la case.';
    } else if (f.cafOverrideMonthly < 0 || f.cafOverrideMonthly > LIMITS.cafMax) {
      errors.caf = `Le total CAF doit être compris entre 0 et ${formatEuro(LIMITS.cafMax)} par mois.`;
    } else {
      benefits.cafOverrideMonthly = f.cafOverrideMonthly;
    }
  }

  const extras: NonNullable<Household['extras']> = {};
  const hasKidUnder6 = children.some((c) => c.age < 6);
  if (hasKidUnder6 && f.extras.childcare !== 'none') {
    extras.childcare = f.extras.childcare;
    if (f.extras.childcare !== 'parent' && f.extras.childcareCostMonthly !== null) {
      if (f.extras.childcareCostMonthly < 0 || f.extras.childcareCostMonthly > 5000) {
        errors['extras.childcareCost'] =
          'Le coût de garde doit être compris entre 0 et 5 000 € par mois.';
      } else {
        extras.childcareCostMonthly = f.extras.childcareCostMonthly;
      }
    }
  }
  const annual = (v: number | null, key: string, label: string, set: (n: number) => void) => {
    if (v === null) return;
    if (v < 0 || v > LIMITS.moneyAnnualMax)
      errors[key] = `${label} doit être compris entre 0 et ${formatEuro(LIMITS.moneyAnnualMax)}.`;
    else set(v);
  };
  annual(f.extras.emploiDomicileAnnual, 'extras.emploiDomicile', 'Le montant annuel', (n) => {
    extras.emploiDomicileAnnual = n;
  });
  annual(f.extras.donsAnnual, 'extras.dons', 'Le montant des dons', (n) => {
    extras.donsAnnual = n;
  });
  if (f.extras.consumptionMonthly !== null) {
    if (f.extras.consumptionMonthly < 0 || f.extras.consumptionMonthly > 100_000) {
      errors['extras.consumption'] =
        'La consommation mensuelle doit être comprise entre 0 et 100 000 €.';
    } else {
      extras.consumptionMonthly = f.extras.consumptionMonthly;
    }
  }

  if (Object.keys(errors).length > 0) return { household: null, errors };

  const household: Household = {
    adults: adults as Household['adults'],
    marriedOrPacs: f.couple ? f.marriedOrPacs : false,
    children,
    housing,
    benefits,
    ...(Object.keys(extras).length > 0 ? { extras } : {}),
  };
  return { household, errors };
}

/* ── Household → form (hash restore, cas-types links) ───────────────────── */

export function householdToForm(h: Household): FormState {
  const base = defaultFormState();
  const toForm = (a: Adult): FormAdult =>
    defaultAdult({
      age: a.age,
      activity: a.activity,
      disability: a.disability,
      ...(a.salary
        ? {
            salaryAmount: a.salary.amount,
            salaryBasis: a.salary.basis,
            salaryStatus: a.salary.status,
            workRatio: a.salary.workRatio ?? 1,
          }
        : { salaryAmount: a.activity === 'salarie' ? SMIC_NET_MONTHLY : null }),
      ...(a.unemployment
        ? { areOn: a.unemployment.areMonthly > 0, areMonthly: a.unemployment.areMonthly }
        : { areOn: false, areMonthly: 1200 }),
      ...(a.pension
        ? {
            pensionAmount: a.pension.amount,
            pensionBasis: a.pension.basis,
            pensionStartYear: a.pension.startYear,
          }
        : {}),
    });
  const adults: [FormAdult, FormAdult] = [
    toForm(h.adults[0]),
    h.adults[1] ? toForm(h.adults[1]) : base.adults[1],
  ];
  return {
    couple: h.adults.length === 2,
    marriedOrPacs: h.marriedOrPacs,
    adults,
    children: h.children.map((c) => ({
      id: newChildId(),
      age: c.age,
      aeeh: !!c.aeeh,
      cmi: c.cmiInvalidite === true,
    })),
    housing: {
      status: h.housing.status,
      rentMonthly:
        h.housing.rentMonthly ?? (h.housing.status === 'locataire' ? 0 : base.housing.rentMonthly),
      zone: h.housing.zone ?? 2,
    },
    nonRecours: h.benefits.nonRecours,
    isolementRecent: !!h.benefits.isolementRecent,
    cafOverrideOn: h.benefits.cafOverrideMonthly !== undefined,
    cafOverrideMonthly: h.benefits.cafOverrideMonthly ?? null,
    extras: {
      childcare: h.extras?.childcare ?? 'none',
      childcareCostMonthly: h.extras?.childcareCostMonthly ?? null,
      emploiDomicileAnnual: h.extras?.emploiDomicileAnnual ?? null,
      donsAnnual: h.extras?.donsAnnual ?? null,
      consumptionMonthly: h.extras?.consumptionMonthly ?? null,
    },
  };
}

/** Does the « Affiner » section hold anything the person typed? (opens the disclosure on restore) */
export function hasExtras(f: FormState): boolean {
  const e = f.extras;
  return (
    e.childcare !== 'none' ||
    e.emploiDomicileAnnual !== null ||
    e.donsAnnual !== null ||
    e.consumptionMonthly !== null ||
    f.isolementRecent ||
    f.adults.slice(0, f.couple ? 2 : 1).some((a) => a.workRatio < 1)
  );
}
