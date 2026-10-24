/**
 * Simulator form state ⇄ engine `Household`.
 *
 * The form keeps UI-friendly values (nullable answers while a question is unanswered, both adults even
 * when « seul·e », a stable id per child) and `formToHousehold` turns them into a valid `Household` or
 * into friendly French error messages keyed by field. No tax logic here — only input hygiene.
 *
 * Nothing is pre-filled with a value that looks like an answer (no age, no salary, no status, no rent):
 * every question that changes the result starts UNANSWERED and the household is invalid until it is
 * answered (docs/qa/FIX-PLAN.md « No result before the user has answered »). The only defaults are the
 * neutral ones: net pay, full time, no disability, no childcare mode.
 */
import type {
  Activity,
  Adult,
  Child,
  Disability,
  Household,
  HousingStatus,
  Hypotheses,
  SalaryStatus,
} from '@/lib/engine-types';
import { formatEuro, formatInteger } from '@/lib/format';

export const LIMITS = {
  adultAge: { min: 18, max: 110 },
  childAge: { min: 0, max: 24 },
  salaryMax: 100_000,
  areMax: 10_000,
  pensionMax: 30_000,
  rentMax: 10_000,
  cafMax: 10_000,
  childSupportMax: 5_000,
  childcareCostMax: 5_000,
  pensionYear: { min: 1970, max: 2040 },
  moneyAnnualMax: 1_000_000,
} as const;

/**
 * The engine's documented defaults (docs/ENGINE-API.md, `DEFAULT_HYPOTHESES`), duplicated here so that the
 * form code never needs the engine at load time (it is a separate, lazily loaded chunk). A unit test keeps
 * both in sync.
 */
export const DEFAULT_HYP: Hypotheses = {
  H1_benefits: 'replaced',
  H2_fraisPro10: true,
  H5_tvaPassThrough: 1,
  includeTva: true,
};

/** « Je ne sais pas » for the housing zone: the engine gets zone 2 (the middle case). */
export type ZoneAnswer = 1 | 2 | 3 | 'inconnue';

export type ChildcareMode = 'none' | 'parent' | 'creche' | 'micro_creche' | 'assistante_maternelle';

export interface FormAdult {
  age: number | null;
  /** `null` = not answered yet. */
  activity: Activity | null;
  salaryAmount: number | null;
  salaryBasis: 'net' | 'brut';
  /** `null` = not answered yet (required for salaried people). */
  salaryStatus: SalaryStatus | null;
  /** 1 = temps plein. */
  workRatio: number;
  /** Receives unemployment benefit? `null` = not answered yet. */
  areOn: boolean | null;
  areMonthly: number | null;
  pensionAmount: number | null;
  pensionBasis: 'net' | 'brut';
  /** `null` = already retired (the engine gets a past year). Only asked under « Affiner ». */
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
  /** `null` = not answered yet. */
  couple: boolean | null;
  /** Only asked for couples. `null` = not answered yet. */
  marriedOrPacs: boolean | null;
  adults: [FormAdult, FormAdult];
  children: FormChild[];
  /** Lone parents: child support received (`received === null` = not answered yet). */
  childSupport: { received: boolean | null; monthly: number | null };
  housing: {
    status: HousingStatus | null;
    rentMonthly: number | null;
    zone: ZoneAnswer | null;
  };
  nonRecours: boolean;
  /** Lone parent separated less than 18 months ago (RSA / prime d'activité « majoré »). */
  isolementRecent: boolean;
  cafOverrideOn: boolean;
  cafOverrideMonthly: number | null;
  extras: {
    childcare: ChildcareMode;
    childcareCostMonthly: number | null;
    emploiDomicileAnnual: number | null;
    donsAnnual: number | null;
    consumptionMonthly: number | null;
  };
}

let childSeq = 0;
export const newChildId = () => `c${++childSeq}`;

export function emptyAdult(overrides: Partial<FormAdult> = {}): FormAdult {
  return {
    age: null,
    activity: null,
    salaryAmount: null,
    salaryBasis: 'net',
    salaryStatus: null,
    workRatio: 1,
    areOn: null,
    areMonthly: null,
    pensionAmount: null,
    pensionBasis: 'net',
    pensionStartYear: null,
    disability: 'none',
    ...overrides,
  };
}

/** The state shown before the person touches anything: nothing answered. */
export function emptyFormState(): FormState {
  return {
    couple: null,
    marriedOrPacs: null,
    adults: [emptyAdult(), emptyAdult()],
    children: [],
    childSupport: { received: null, monthly: null },
    housing: { status: null, rentMonthly: null, zone: null },
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

/**
 * Keys: `foyer.couple`, `foyer.married`, `foyer.childSupport`, `childSupport.amount`, `child2.age`,
 * `adult0.age`, `adult1.salary`, `housing.rent`, `caf`, `extras.childcareCost`… (insertion order = form order).
 */
export type FieldErrors = Record<string, string>;

const range = (n: number, min: number, max: number) => n >= min && n <= max;

export type StepId = 'foyer' | 'adults' | 'logement' | 'aides';
export const STEPS: StepId[] = ['foyer', 'adults', 'logement', 'aides'];

/** The step (screen on a phone) that holds the field behind an error key. */
export function stepOfError(key: string): StepId {
  if (key.startsWith('adult')) return 'adults';
  if (key.startsWith('housing')) return 'logement';
  if (key === 'caf' || key.startsWith('extras.')) return 'aides';
  return 'foyer';
}

/** Is a child of this age under 20 (the ASF is paid for children under 20)? */
const hasChildUnder20 = (f: FormState) => f.children.some((c) => c.age !== null && c.age < 20);
/** The question « pension alimentaire » concerns a lone parent of a child under 20. */
export const asksChildSupport = (f: FormState) => f.couple === false && hasChildUnder20(f);

export function formToHousehold(f: FormState): {
  household: Household | null;
  errors: FieldErrors;
} {
  const errors: FieldErrors = {};
  const couple = f.couple === true;
  const count = couple ? 2 : 1;
  const adults: Adult[] = [];

  if (f.couple === null) errors['foyer.couple'] = 'Indiquez si vous vivez seul·e ou en couple.';
  if (couple && f.marriedOrPacs === null)
    errors['foyer.married'] = 'Indiquez si vous êtes marié·e ou pacsé·e.';

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

  let childSupport: number | undefined;
  if (asksChildSupport(f)) {
    if (f.childSupport.received === null) {
      errors['foyer.childSupport'] = 'Indiquez si vous recevez une pension alimentaire.';
    } else if (f.childSupport.received) {
      const m = f.childSupport.monthly;
      if (m === null || m <= 0) {
        errors['childSupport.amount'] = 'Indiquez le montant reçu chaque mois (supérieur à 0 €).';
      } else if (m > LIMITS.childSupportMax) {
        errors['childSupport.amount'] =
          `Ce montant dépasse ${formatEuro(LIMITS.childSupportMax)} par mois : vérifiez la saisie.`;
      } else {
        childSupport = m;
      }
    }
  }

  for (let i = 0; i < count; i++) {
    const a = f.adults[i]!;
    const k = `adult${i}`;
    const you = i === 0;
    const poss = you ? 'votre' : 'son';
    const A = you ? 'Votre' : 'Son';
    const adult: Adult = { age: 0, activity: a.activity ?? 'inactif', disability: a.disability };

    if (a.age === null) {
      errors[`${k}.age`] = you
        ? 'Indiquez votre âge, par exemple 35.'
        : 'Indiquez l’âge de votre conjoint·e, par exemple 35.';
    } else if (!range(a.age, LIMITS.adultAge.min, LIMITS.adultAge.max)) {
      errors[`${k}.age`] =
        `${A} âge doit être compris entre ${LIMITS.adultAge.min} et ${LIMITS.adultAge.max} ans. Pour un mineur, voir le foyer de ses parents.`;
    } else {
      adult.age = a.age;
    }

    if (a.activity === null) {
      errors[`${k}.activity`] = you
        ? 'Indiquez ce que vous faites : salarié·e, retraité·e…'
        : 'Indiquez ce que fait votre conjoint·e : salarié·e, retraité·e…';
    } else if (a.activity === 'salarie') {
      if (a.salaryStatus === null) {
        errors[`${k}.status`] = you
          ? 'Indiquez votre statut : salarié du privé, fonctionnaire, dirigeant…'
          : 'Indiquez le statut de votre conjoint·e : salarié du privé, fonctionnaire, dirigeant…';
      } else if (a.salaryStatus === 'tns') {
        // Not modelled: the engine ignores the income and flags the comparison `unsupported`.
        adult.salary = { amount: 0, basis: a.salaryBasis, status: 'tns' };
      } else if (a.salaryAmount === null || a.salaryAmount <= 0) {
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
    } else if (a.activity === 'chomage') {
      if (a.areOn === null) {
        errors[`${k}.are`] = you
          ? 'Indiquez si vous touchez une allocation chômage.'
          : 'Indiquez si votre conjoint·e touche une allocation chômage.';
      } else if (a.areOn) {
        if (a.areMonthly === null || a.areMonthly <= 0) {
          errors[`${k}.are`] =
            'Indiquez le montant mensuel de l’allocation, ou choisissez « Non indemnisé·e ».';
        } else if (a.areMonthly > LIMITS.areMax) {
          errors[`${k}.are`] =
            `Ce montant dépasse ${formatEuro(LIMITS.areMax)} par mois : vérifiez la saisie.`;
        } else {
          adult.unemployment = { areMonthly: a.areMonthly };
        }
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
      if (
        a.pensionStartYear !== null &&
        !range(a.pensionStartYear, LIMITS.pensionYear.min, LIMITS.pensionYear.max)
      ) {
        errors[`${k}.pensionYear`] =
          `L’année de départ doit être comprise entre ${LIMITS.pensionYear.min} et ${LIMITS.pensionYear.max}.`;
        ok = false;
      }
      if (ok) {
        adult.pension = {
          amount: a.pensionAmount!,
          basis: a.pensionBasis,
          // « déjà à la retraite » : une année passée suffit, le plan ne distingue que « avant 2028 »
          startYear: a.pensionStartYear ?? 2020,
        };
      }
    }
    adults.push(adult);
  }

  const housing: Household['housing'] = { status: f.housing.status ?? 'locataire' };
  if (f.housing.status === null) {
    errors['housing.status'] = 'Indiquez si vous êtes locataire, propriétaire ou hébergé·e.';
  } else if (f.housing.status === 'locataire') {
    if (f.housing.rentMonthly === null) {
      errors['housing.rent'] =
        'Indiquez votre loyer mensuel hors charges (0 si vous ne payez pas de loyer).';
    } else if (f.housing.rentMonthly < 0 || f.housing.rentMonthly > LIMITS.rentMax) {
      errors['housing.rent'] =
        `Le loyer doit être compris entre 0 et ${formatEuro(LIMITS.rentMax)} par mois.`;
    } else {
      housing.rentMonthly = f.housing.rentMonthly;
    }
    if (f.housing.zone === null) {
      errors['housing.zone'] = 'Choisissez la zone de votre logement, ou « Je ne sais pas ».';
    }
  }
  housing.zone = f.housing.zone === 1 || f.housing.zone === 3 ? f.housing.zone : 2;

  const benefits: Household['benefits'] = { nonRecours: f.nonRecours };
  if (f.isolementRecent && !couple && f.children.length > 0) benefits.isolementRecent = true;
  if (childSupport !== undefined) benefits.childSupportReceivedMonthly = childSupport;
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
      if (
        f.extras.childcareCostMonthly < 0 ||
        f.extras.childcareCostMonthly > LIMITS.childcareCostMax
      ) {
        errors['extras.childcareCost'] =
          `Le coût de garde doit être compris entre 0 et ${formatEuro(LIMITS.childcareCostMax)} par mois.`;
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
    marriedOrPacs: couple ? f.marriedOrPacs === true : false,
    children,
    housing,
    benefits,
    ...(Object.keys(extras).length > 0 ? { extras } : {}),
  };
  return { household, errors };
}

/**
 * Short, lower-case names of the unanswered questions, in form order (« votre âge », « le loyer »…):
 * « Il manque : votre âge, votre activité… ». One entry per field.
 */
export function missingLabels(errors: FieldErrors): string[] {
  const out: string[] = [];
  const add = (s: string) => {
    if (!out.includes(s)) out.push(s);
  };
  for (const key of Object.keys(errors)) {
    let m: RegExpExecArray | null;
    if (key === 'foyer.couple') add('si vous vivez seul·e ou en couple');
    else if (key === 'foyer.married') add('si vous êtes marié·e ou pacsé·e');
    else if ((m = /^child(\d+)\.age$/.exec(key))) add(`l’âge de l’enfant ${Number(m[1]) + 1}`);
    else if (key === 'foyer.childSupport' || key === 'childSupport.amount')
      add('la pension alimentaire');
    else if ((m = /^adult(\d)\.(\w+)$/.exec(key))) {
      const you = m[1] === '0';
      const f = m[2];
      if (f === 'age') add(you ? 'votre âge' : 'son âge');
      else if (f === 'activity') add(you ? 'votre activité' : 'son activité');
      else if (f === 'status') add(you ? 'votre statut' : 'son statut');
      else if (f === 'salary') add(you ? 'votre salaire' : 'son salaire');
      else if (f === 'are') add(you ? 'votre allocation chômage' : 'son allocation chômage');
      else if (f === 'pension') add(you ? 'votre pension' : 'sa pension');
      else add(you ? 'votre année de départ' : 'son année de départ');
    } else if (key === 'housing.status') add('votre logement');
    else if (key === 'housing.rent') add('votre loyer');
    else if (key === 'housing.zone') add('la zone de votre logement');
    else if (key === 'caf') add('le total versé par la CAF');
    else add('un champ à corriger');
  }
  return out;
}

/* ── Household → form (hash restore, cas-types links) ───────────────────── */

export function householdToForm(h: Household): FormState {
  const base = emptyFormState();
  const toForm = (a: Adult): FormAdult =>
    emptyAdult({
      age: a.age,
      activity: a.activity,
      disability: a.disability,
      ...(a.salary
        ? {
            salaryAmount: a.salary.status === 'tns' ? null : a.salary.amount,
            salaryBasis: a.salary.basis,
            salaryStatus: a.salary.status,
            workRatio: a.salary.workRatio ?? 1,
          }
        : {}),
      ...(a.unemployment
        ? { areOn: a.unemployment.areMonthly > 0, areMonthly: a.unemployment.areMonthly }
        : a.activity === 'chomage'
          ? { areOn: false }
          : {}),
      ...(a.pension
        ? {
            pensionAmount: a.pension.amount,
            pensionBasis: a.pension.basis,
            // Only keep a year that says something (a future retirement); the default is « déjà retraité·e ».
            pensionStartYear: a.pension.startYear >= 2027 ? a.pension.startYear : null,
          }
        : {}),
    });
  const adults: [FormAdult, FormAdult] = [
    toForm(h.adults[0]),
    h.adults[1] ? toForm(h.adults[1]) : base.adults[1],
  ];
  const support = h.benefits.childSupportReceivedMonthly;
  const zone = h.housing.zone ?? 2;
  return {
    couple: h.adults.length === 2,
    marriedOrPacs: h.adults.length === 2 ? h.marriedOrPacs : null,
    adults,
    children: h.children.map((c) => ({
      id: newChildId(),
      age: c.age,
      aeeh: !!c.aeeh,
      cmi: c.cmiInvalidite === true,
    })),
    childSupport:
      support !== undefined && support > 0
        ? { received: true, monthly: support }
        : { received: false, monthly: null },
    housing: {
      status: h.housing.status,
      rentMonthly: h.housing.status === 'locataire' ? (h.housing.rentMonthly ?? 0) : null,
      zone: zone === 1 || zone === 3 ? zone : 2,
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
  const adults = f.adults.slice(0, f.couple ? 2 : 1);
  return (
    e.emploiDomicileAnnual !== null ||
    e.donsAnnual !== null ||
    e.consumptionMonthly !== null ||
    f.isolementRecent ||
    adults.some((a) => a.workRatio < 1 || a.pensionStartYear !== null)
  );
}
