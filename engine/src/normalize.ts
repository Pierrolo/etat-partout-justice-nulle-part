/**
 * Input validation / normalisation. Never throws on user input: out-of-range values are clamped and reported in
 * `warnings` (French). Net salaries are inverted to gross here (gross is the anchor of both scenarios).
 */
import { grossFromNet } from './baseline/salaire.ts';
import { eur } from './fmt.ts';
import type { Activity, Disability, Household, HousingStatus, SalaryStatus } from './types.ts';

export interface NAdult {
  index: number;
  age: number;
  activity: Activity;
  disability: Disability;
  salary: {
    gross: number;
    status: SalaryStatus;
    workRatio: number;
    inputNet: number | null;
  } | null;
  areNet: number;
  pension: { amount: number; basis: 'net' | 'brut'; startYear: number } | null;
}
export interface NChild {
  age: number;
  aeeh: boolean;
  cmiInvalidite: boolean;
}
export interface NHousehold {
  adults: NAdult[];
  married: boolean;
  children: NChild[];
  housing: { status: HousingStatus; rent: number; zone: 1 | 2 | 3 };
  nonRecours: boolean;
  cafOverride: number | null;
  isolementRecent: boolean;
  childcare: 'parent' | 'creche' | 'assistante_maternelle' | 'micro_creche' | null;
  childcareCostMonthly: number;
  /** false when `extras.childcareCostMonthly` was not given (a default is then used for a paid mode) */
  childcareCostProvided: boolean;
  /** pension alimentaire received, €/month (v1.1) */
  childSupport: number;
  /** parts of the household outside the model (v1.1), French */
  unsupported: string[];
  emploiDomicileAnnual: number;
  donsAnnual: number;
  consumptionMonthly: number | null;
  warnings: string[];
}

const ACTIVITIES: Activity[] = ['salarie', 'chomage', 'retraite', 'etudiant', 'inactif'];
const STATUSES: SalaryStatus[] = ['prive', 'cadre', 'fonctionnaire', 'dirigeant_assimile'];
const DISABILITIES: Disability[] = ['none', 'aah_80', 'aah_50_79'];
const HOUSING: HousingStatus[] = ['locataire', 'proprietaire', 'proprietaire_credit', 'gratuit'];

const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const fin = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
function money(x: unknown, w: string[], what: string): number {
  if (x === undefined || x === null) return 0;
  if (!fin(x)) {
    w.push(`${what} : valeur non numérique ignorée.`);
    return 0;
  }
  if (x < 0) {
    w.push(`${what} : montant négatif ramené à 0.`);
    return 0;
  }
  return x;
}

export function normalize(h: Household): NHousehold {
  const w: string[] = [];
  const unsupported: string[] = [];
  const raw: unknown = h;
  const hh = isObj(raw) ? raw : {};
  let adultsIn = Array.isArray(hh.adults) ? (hh.adults as unknown[]) : [];
  if (adultsIn.length === 0) {
    w.push('Aucun adulte renseigné : un adulte inactif de 30 ans est supposé.');
    adultsIn = [{ age: 30, activity: 'inactif', disability: 'none' }];
  }
  if (adultsIn.length > 2) {
    w.push('Plus de deux adultes : seuls les deux premiers sont simulés.');
    adultsIn = adultsIn.slice(0, 2);
  }

  const adults: NAdult[] = adultsIn.map((a0, index) => {
    const a = isObj(a0) ? a0 : {};
    const who = `Adulte ${index + 1}`;
    let age = fin(a.age) ? Math.floor(a.age) : 30;
    if (!fin(a.age)) w.push(`${who} : âge manquant, 30 ans supposés.`);
    if (age < 18) {
      w.push(`${who} : âge ${age} ans hors du champ (adulte ≥ 18 ans) ; 18 ans retenus.`);
      age = 18;
    }
    if (age > 110) {
      w.push(`${who} : âge ramené à 110 ans.`);
      age = 110;
    }
    const activity: Activity = ACTIVITIES.includes(a.activity as Activity)
      ? (a.activity as Activity)
      : 'inactif';
    if (!ACTIVITIES.includes(a.activity as Activity))
      w.push(`${who} : activité inconnue, « inactif » retenu.`);
    const disability: Disability = DISABILITIES.includes(a.disability as Disability)
      ? (a.disability as Disability)
      : 'none';

    let salary: NAdult['salary'] = null;
    if (isObj(a.salary)) {
      const s = a.salary;
      const amount = money(s.amount, w, `${who} : salaire`);
      if ((activity === 'salarie' || activity === 'etudiant') && s.status === 'tns') {
        // v1.1 safe behaviour: the TNS regime (cotisations SSI, BIC/BNC, micro-entreprise) is not modelled —
        // the income is left out of both scenarios and the comparison is flagged `unsupported`.
        const msg = `${who} : travailleur·se non salarié·e (gérant·e majoritaire de SARL, indépendant·e, micro-entrepreneur·e) — ce régime n’est pas modélisé : son revenu n’est pas pris en compte, et le résultat ne décrit pas votre ménage. Si vous êtes président·e de SAS/SASU ou gérant·e minoritaire de SARL, choisissez « dirigeant·e assimilé·e salarié·e ».`;
        w.push(msg);
        unsupported.push(msg);
      } else if (activity === 'salarie' || activity === 'etudiant') {
        if (amount > 0) {
          const status: SalaryStatus = STATUSES.includes(s.status as SalaryStatus)
            ? (s.status as SalaryStatus)
            : 'prive';
          let workRatio = fin(s.workRatio) ? s.workRatio : 1;
          if (workRatio <= 0 || workRatio > 1) {
            w.push(`${who} : quotité de travail ramenée dans ]0 ; 1].`);
            workRatio = Math.min(1, Math.max(0.05, workRatio));
          }
          const basis = s.basis === 'brut' ? 'brut' : 'net';
          const gross = basis === 'brut' ? amount : grossFromNet(amount, status);
          salary = { gross, status, workRatio, inputNet: basis === 'net' ? amount : null };
          if (gross > 4 * 4005)
            w.push(
              `${who} : salaire brut ${eur(gross)} au-delà de 4 PASS mensuels — résultats indicatifs (CEHR/CDHR non modélisées).`,
            );
        }
      } else if (amount > 0) {
        w.push(
          `${who} : salaire ignoré car l’activité déclarée est « ${activity} » (cumul non modélisé).`,
        );
      }
    }
    let areNet = 0;
    if (isObj(a.unemployment)) {
      const are = money(a.unemployment.areMonthly, w, `${who} : ARE`);
      if (activity === 'chomage') areNet = are;
      else if (are > 0)
        w.push(`${who} : ARE ignorée car l’activité déclarée n’est pas « sans emploi ».`);
    }
    let pension: NAdult['pension'] = null;
    if (isObj(a.pension)) {
      const p = a.pension;
      const amount = money(p.amount, w, `${who} : pension`);
      if (activity === 'retraite') {
        let startYear = fin(p.startYear) ? Math.floor(p.startYear) : 2020;
        if (!fin(p.startYear))
          w.push(`${who} : année de départ en retraite manquante, 2020 supposée.`);
        if (startYear > 2060 || startYear < 1950) {
          w.push(`${who} : année de départ en retraite hors plage, ramenée dans [1950 ; 2060].`);
          startYear = Math.min(2060, Math.max(1950, startYear));
        }
        if (amount > 0 || startYear > 0)
          pension = { amount, basis: p.basis === 'brut' ? 'brut' : 'net', startYear };
      } else if (amount > 0)
        w.push(`${who} : pension ignorée car l’activité déclarée n’est pas « retraité·e ».`);
    }
    if (activity === 'retraite' && pension === null)
      pension = { amount: 0, basis: 'net', startYear: 2020 };
    return { index, age, activity, disability, salary, areNet, pension };
  });

  const childrenIn = Array.isArray(hh.children) ? (hh.children as unknown[]) : [];
  const children: NChild[] = [];
  for (const c0 of childrenIn) {
    const c = isObj(c0) ? c0 : {};
    if (!fin(c.age)) {
      w.push('Enfant sans âge ignoré.');
      continue;
    }
    let age = Math.floor(c.age);
    if (age > 24) {
      w.push(`Enfant de ${age} ans ignoré (au-delà de 24 ans, il forme son propre foyer).`);
      continue;
    }
    if (age < 0) age = 0;
    const aeeh = c.aeeh === true;
    // H15 (audit 2026-10): the CMI « invalidité » (taux ≥ 80 %) is NOT implied by the AEEH, which can be granted
    // at 50–79 % ; the +6 600 € AFU supplement needs an explicit `cmiInvalidite: true`.
    children.push({ age, aeeh, cmiInvalidite: aeeh && c.cmiInvalidite === true });
  }
  if (children.length > 12) {
    w.push('Plus de 12 enfants : seuls les 12 premiers sont simulés.');
    children.length = 12;
  }

  const hs = isObj(hh.housing) ? hh.housing : {};
  let status: HousingStatus = HOUSING.includes(hs.status as HousingStatus)
    ? (hs.status as HousingStatus)
    : 'gratuit';
  if (!HOUSING.includes(hs.status as HousingStatus)) {
    w.push('Statut de logement inconnu : « hébergé·e gratuitement » retenu.');
    status = 'gratuit';
  }
  let rent = 0;
  let zone: 1 | 2 | 3 = hs.zone === 1 || hs.zone === 3 ? hs.zone : 2;
  if (status === 'locataire') {
    rent = money(hs.rentMonthly, w, 'Loyer');
    if (rent === 0)
      w.push('Loyer non renseigné : aides au logement calculées pour un loyer de 0 €.');
    if (hs.zone !== 1 && hs.zone !== 2 && hs.zone !== 3) {
      w.push('Zone de logement non renseignée : zone 2 retenue.');
      zone = 2;
    }
  }

  const b = isObj(hh.benefits) ? hh.benefits : {};
  const ex = isObj(hh.extras) ? hh.extras : {};
  const cafOverride =
    b.cafOverrideMonthly === undefined || b.cafOverrideMonthly === null
      ? null
      : money(b.cafOverrideMonthly, w, 'Total CAF déclaré');
  const childcare =
    ex.childcare === 'creche' ||
    ex.childcare === 'assistante_maternelle' ||
    ex.childcare === 'micro_creche' ||
    ex.childcare === 'parent'
      ? ex.childcare
      : null;
  const consumption =
    ex.consumptionMonthly === undefined || ex.consumptionMonthly === null
      ? null
      : money(ex.consumptionMonthly, w, 'Consommation mensuelle');

  if (adults.length === 2 && hh.marriedOrPacs !== true && hh.marriedOrPacs !== false)
    w.push('Situation conjugale non renseignée : couple non marié·e/pacsé·e retenu.');

  return {
    adults,
    married: adults.length === 2 && hh.marriedOrPacs === true,
    children,
    housing: { status, rent, zone },
    nonRecours: b.nonRecours === true,
    cafOverride,
    isolementRecent: b.isolementRecent === true,
    childcare,
    childcareCostMonthly: money(ex.childcareCostMonthly, w, 'Frais de garde'),
    childcareCostProvided: fin(ex.childcareCostMonthly) && ex.childcareCostMonthly >= 0,
    childSupport: money(b.childSupportReceivedMonthly, w, 'Pension alimentaire reçue'),
    unsupported,
    emploiDomicileAnnual: money(ex.emploiDomicileAnnual, w, 'Emploi à domicile'),
    donsAnnual: money(ex.donsAnnual, w, 'Dons'),
    consumptionMonthly: consumption,
    warnings: w,
  };
}
