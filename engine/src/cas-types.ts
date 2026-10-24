/**
 * Standard households for the « Qui gagne, qui perd ? » heatmap: illustrative, NOT weighted (no population claim).
 * They span the 18 « fiches » situations of the book (travailleur, sans emploi, agent public, jeune adulte, famille,
 * retraité, locataire, personne handicapée, foyer, contribuable…) and income levels 0 to 5 SMIC.
 * Salaries are given in GROSS multiples of the 2026 SMIC (1 867,02 €/month) unless stated.
 */
import { n } from './params/index.ts';
import type { Adult, Child, Household } from './types.ts';

const SMIC = n('general.smic_monthly_gross_35h');

const worker = (
  smic: number,
  opts: Partial<{ age: number; status: 'prive' | 'cadre' | 'fonctionnaire'; net: number }> = {},
): Adult => {
  if (opts.net !== undefined)
    return {
      age: opts.age ?? 35,
      activity: 'salarie',
      disability: 'none',
      salary: { amount: opts.net, basis: 'net', status: opts.status ?? 'prive' },
    };
  const part = smic < 1 ? smic : 1;
  return {
    age: opts.age ?? 35,
    activity: 'salarie',
    disability: 'none',
    salary: {
      amount: Math.round(SMIC * smic * 100) / 100,
      basis: 'brut',
      status: opts.status ?? 'prive',
      ...(part < 1 ? { workRatio: part } : {}),
    },
  };
};
const inactive = (age = 35): Adult => ({ age, activity: 'inactif', disability: 'none' });
const retiree = (gross: number, age = 70, startYear = 2018): Adult => ({
  age,
  activity: 'retraite',
  disability: 'none',
  pension: { amount: gross, basis: 'brut', startYear },
});
const kids = (...ages: number[]): Child[] => ages.map((age) => ({ age }));
const rent = (rentMonthly: number, zone: 1 | 2 | 3 = 2): Household['housing'] => ({
  status: 'locataire',
  rentMonthly,
  zone,
});
const OWNER: Household['housing'] = { status: 'proprietaire' };
const OWNER_CREDIT: Household['housing'] = { status: 'proprietaire_credit' };
const NB = { nonRecours: false };

const hh = (
  adults: Household['adults'],
  children: Child[],
  housing: Household['housing'],
  married = true,
  extras?: Household['extras'],
): Household => ({
  adults,
  marriedOrPacs: adults.length === 2 ? married : false,
  children,
  housing,
  benefits: { ...NB },
  ...(extras ? { extras } : {}),
});

export interface CasType {
  id: string;
  label: string;
  family: string;
  household: Household;
}

export const CAS_TYPES: CasType[] = [
  // ---- personnes seules (fiche Travailleur, Locataire, Contribuable) ----
  {
    id: 'seul-0',
    family: 'Personnes seules',
    label: 'Seul·e, sans revenu (RSA), locataire 450 € zone 2',
    household: hh([inactive()], [], rent(450)),
  },
  {
    id: 'seul-0.5',
    family: 'Personnes seules',
    label: 'Seul·e, mi-temps au SMIC, locataire 500 € zone 2',
    household: hh([worker(0.5)], [], rent(500)),
  },
  {
    id: 'seul-1',
    family: 'Personnes seules',
    label: 'Seul·e, 1 SMIC, locataire 550 € zone 2',
    household: hh([worker(1)], [], rent(550)),
  },
  {
    id: 'seul-1-z1',
    family: 'Personnes seules',
    label: 'Seul·e, 1 SMIC, locataire 750 € zone 1 (Paris)',
    household: hh([worker(1)], [], rent(750, 1)),
  },
  {
    id: 'seul-1-proprio',
    family: 'Personnes seules',
    label: 'Seul·e, 1 SMIC, propriétaire',
    household: hh([worker(1)], [], OWNER),
  },
  {
    id: 'seul-1.5',
    family: 'Personnes seules',
    label: 'Seul·e, 1,5 SMIC, locataire 650 € zone 2',
    household: hh([worker(1.5)], [], rent(650)),
  },
  {
    id: 'seul-2',
    family: 'Personnes seules',
    label: 'Seul·e, 2 SMIC, locataire 750 € zone 2',
    household: hh([worker(2)], [], rent(750)),
  },
  {
    id: 'seul-3',
    family: 'Personnes seules',
    label: 'Seul·e, 3 SMIC (cadre), locataire 900 € zone 1',
    household: hh([worker(3, { status: 'cadre' })], [], rent(900, 1)),
  },
  {
    id: 'seul-5',
    family: 'Personnes seules',
    label: 'Seul·e, 5 SMIC (cadre), propriétaire',
    household: hh([worker(5, { status: 'cadre' })], [], OWNER),
  },

  // ---- couples sans enfant ----
  {
    id: 'couple-1-0',
    family: 'Couples sans enfant',
    label: 'Couple marié, 1 SMIC + inactif·ve, locataire 650 € zone 2',
    household: hh([worker(1), inactive()], [], rent(650)),
  },
  {
    id: 'couple-1-1',
    family: 'Couples sans enfant',
    label: 'Couple marié, 2 × SMIC, locataire 800 € zone 2',
    household: hh([worker(1), worker(1)], [], rent(800)),
  },
  {
    id: 'couple-2-1',
    family: 'Couples sans enfant',
    label: 'Couple marié, 2 SMIC + 1 SMIC, propriétaire (crédit)',
    household: hh([worker(2), worker(1)], [], OWNER_CREDIT),
  },
  {
    id: 'couple-5-0-marie',
    family: 'Couples sans enfant',
    label: 'Couple marié, 5 SMIC (cadre) + sans revenu, propriétaire',
    household: hh([worker(5, { status: 'cadre' }), inactive()], [], OWNER),
  },
  {
    id: 'couple-5-0-concubins',
    family: 'Couples sans enfant',
    label: 'Couple non marié, 5 SMIC (cadre) + sans revenu, propriétaire',
    household: hh([worker(5, { status: 'cadre' }), inactive()], [], OWNER, false),
  },

  // ---- couples avec enfants (fiche Famille) ----
  {
    id: 'famille-1-0-2e',
    family: 'Couples avec enfants',
    label: 'Couple, 1 SMIC + inactif·ve, 2 enfants (6, 10), locataire 700 € zone 2',
    household: hh([worker(1), inactive()], kids(6, 10), rent(700)),
  },
  {
    id: 'famille-1-1-2e',
    family: 'Couples avec enfants',
    label: 'Couple, 2 × SMIC, 2 enfants (6, 10), locataire 800 € zone 2',
    household: hh([worker(1), worker(1)], kids(6, 10), rent(800)),
  },
  {
    id: 'famille-1.5-1-3e',
    family: 'Couples avec enfants',
    label: 'Couple, 1,5 + 1 SMIC, 3 enfants (5, 9, 16), locataire 850 € zone 2',
    household: hh([worker(1.5), worker(1)], kids(5, 9, 16), rent(850)),
  },
  {
    id: 'famille-2-2-creche',
    family: 'Couples avec enfants',
    label: 'Couple, 2 × 2 SMIC, 2 enfants (1, 4) en crèche, propriétaire (crédit)',
    household: hh([worker(2), worker(2)], kids(1, 4), OWNER_CREDIT, true, {
      childcare: 'creche',
      childcareCostMonthly: 450,
    }),
  },
  {
    id: 'famille-3-2-2e',
    family: 'Couples avec enfants',
    label: 'Couple de cadres, 3 + 2 SMIC, 2 enfants (8, 12), propriétaire',
    household: hh(
      [worker(3, { status: 'cadre' }), worker(2, { status: 'cadre' })],
      kids(8, 12),
      OWNER,
    ),
  },
  {
    id: 'famille-5-3-3e',
    family: 'Couples avec enfants',
    label: 'Couple aisé, 5 + 3 SMIC, 3 enfants (4, 9, 14), emploi à domicile 6 000 €/an',
    household: hh(
      [worker(5, { status: 'cadre' }), worker(3, { status: 'cadre' })],
      kids(4, 9, 14),
      OWNER,
      true,
      { emploiDomicileAnnual: 6000, donsAnnual: 1000 },
    ),
  },
  {
    id: 'famille-1-1-4e',
    family: 'Couples avec enfants',
    label: 'Couple, 2 × SMIC, 4 enfants (3, 7, 11, 15), locataire 950 € zone 2',
    household: hh([worker(1), worker(1)], kids(3, 7, 11, 15), rent(950)),
  },
  {
    id: 'famille-jeune-majeur',
    family: 'Couples avec enfants',
    label: 'Couple, 1,5 + 1 SMIC, enfants de 15 et 20 ans (étudiant rattaché)',
    household: hh([worker(1.5), worker(1)], kids(15, 20), rent(800)),
  },

  // ---- familles monoparentales ----
  {
    id: 'mono-0-1e',
    family: 'Familles monoparentales',
    label: 'Parent isolé sans revenu, 1 enfant de 2 ans, locataire 600 € zone 2',
    household: hh([inactive(30)], kids(2), rent(600)),
  },
  {
    id: 'mono-0.5-2e',
    family: 'Familles monoparentales',
    label: 'Parent isolé, mi-temps SMIC, 2 enfants (4, 9), locataire 700 € zone 2',
    household: hh([worker(0.5)], kids(4, 9), rent(700)),
  },
  {
    id: 'mono-1-1e',
    family: 'Familles monoparentales',
    label: 'Parent isolé, 1 SMIC, 1 enfant (5), locataire 600 € zone 2',
    household: hh([worker(1)], kids(5), rent(600)),
  },
  {
    id: 'mono-1-2e',
    family: 'Familles monoparentales',
    label: 'Parent isolé, 1 SMIC, 2 enfants (4, 9), locataire 700 € zone 2',
    household: hh([worker(1)], kids(4, 9), rent(700)),
  },
  {
    id: 'mono-1.5-2e',
    family: 'Familles monoparentales',
    label: 'Parent isolé, 1,5 SMIC, 2 enfants (4, 9), locataire 750 € zone 2',
    household: hh([worker(1.5)], kids(4, 9), rent(750)),
  },
  {
    id: 'mono-2-3e',
    family: 'Familles monoparentales',
    label: 'Parent isolé, 2 SMIC, 3 enfants (7, 12, 15), locataire 900 € zone 1',
    household: hh([worker(2)], kids(7, 12, 15), rent(900, 1)),
  },

  // ---- retraités (fiche Retraité) ----
  {
    id: 'retraite-aspa',
    family: 'Retraités',
    label: 'Retraité·e seul·e, pension 900 € brut (ASPA), locataire 450 € zone 3',
    household: hh([retiree(900, 75)], [], rent(450, 3)),
  },
  {
    id: 'retraite-1200',
    family: 'Retraités',
    label: 'Retraité·e seul·e, pension 1 200 € brut, locataire 500 € zone 2',
    household: hh([retiree(1200)], [], rent(500)),
  },
  {
    id: 'retraite-1800',
    family: 'Retraités',
    label: 'Retraité·e seul·e, pension 1 800 € brut, propriétaire',
    household: hh([retiree(1800)], [], OWNER),
  },
  {
    id: 'retraite-3000',
    family: 'Retraités',
    label: 'Retraité·e seul·e, pension 3 000 € brut, propriétaire',
    household: hh([retiree(3000)], [], OWNER),
  },
  {
    id: 'retraite-couple-3200',
    family: 'Retraités',
    label: 'Couple retraité, pensions 2 000 + 1 200 € brut, propriétaire',
    household: hh([retiree(2000), retiree(1200, 68)], [], OWNER),
  },
  {
    id: 'retraite-couple-6000',
    family: 'Retraités',
    label: 'Couple retraité aisé, pensions 3 500 + 2 500 € brut, propriétaire',
    household: hh([retiree(3500, 72), retiree(2500, 70)], [], OWNER),
  },
  {
    id: 'retraite-2028',
    family: 'Retraités',
    label: 'Retraité·e seul·e, pension 1 800 € brut liquidée en 2028 (sans majoration AFU)',
    household: hh([retiree(1800, 64, 2028)], [], OWNER),
  },

  // ---- handicap (fiche Personne handicapée) ----
  {
    id: 'aah80-seul',
    family: 'Handicap',
    label: 'Adulte handicapé (≥ 80 %, CMI invalidité), sans revenu, locataire 450 € zone 2',
    household: hh([{ ...inactive(40), disability: 'aah_80' }], [], rent(450)),
  },
  {
    id: 'aah50-seul',
    family: 'Handicap',
    label: 'Adulte handicapé (50–79 %), sans revenu, locataire 450 € zone 2',
    household: hh([{ ...inactive(40), disability: 'aah_50_79' }], [], rent(450)),
  },
  {
    id: 'aah80-mi-temps',
    family: 'Handicap',
    label: 'Adulte handicapé (≥ 80 %), mi-temps au SMIC, locataire 450 € zone 2',
    household: hh([{ ...worker(0.5, { age: 40 }), disability: 'aah_80' }], [], rent(450)),
  },
  {
    id: 'famille-aeeh',
    family: 'Handicap',
    label: 'Couple, 1,5 + 1 SMIC, enfant de 8 ans bénéficiaire de l’AEEH',
    household: hh([worker(1.5), worker(1)], [{ age: 8, aeeh: true }], rent(800)),
  },

  // ---- jeunes (fiche Jeune adulte) ----
  {
    id: 'etudiant',
    family: 'Jeunes',
    label: 'Étudiant·e de 20 ans, sans revenu, locataire 400 € zone 2',
    household: hh([{ age: 20, activity: 'etudiant', disability: 'none' }], [], rent(400)),
  },
  {
    id: 'jeune-23-smic',
    family: 'Jeunes',
    label: 'Jeune de 23 ans au SMIC, locataire 500 € zone 2',
    household: hh([worker(1, { age: 23 })], [], rent(500)),
  },
  {
    id: 'jeune-22-inactif',
    family: 'Jeunes',
    label: 'Jeune de 22 ans sans revenu (pas de RSA avant 25 ans), hébergé·e',
    household: hh([inactive(22)], [], { status: 'gratuit' }),
  },

  // ---- sans emploi (fiche Personne sans emploi) ----
  {
    id: 'chomeur-are',
    family: 'Sans emploi',
    label: 'Demandeur·se d’emploi, ARE 1 100 € net, locataire 550 € zone 2',
    household: hh(
      [{ age: 40, activity: 'chomage', disability: 'none', unemployment: { areMonthly: 1100 } }],
      [],
      rent(550),
    ),
  },
  {
    id: 'couple-chomeur-2e',
    family: 'Sans emploi',
    label: 'Couple, SMIC + ARE 1 000 €, 2 enfants (6, 10), locataire 800 € zone 2',
    household: hh(
      [
        worker(1),
        { age: 38, activity: 'chomage', disability: 'none', unemployment: { areMonthly: 1000 } },
      ],
      kids(6, 10),
      rent(800),
    ),
  },

  // ---- fonction publique (fiches Agent public, Enseignant) ----
  {
    id: 'fonctionnaire-2000',
    family: 'Fonction publique',
    label: 'Fonctionnaire seul·e, 2 000 € net, locataire 650 € zone 2',
    household: hh([worker(0, { net: 2000, status: 'fonctionnaire' })], [], rent(650)),
  },
  {
    id: 'fonctionnaires-2e',
    family: 'Fonction publique',
    label: 'Couple d’enseignants, 2 300 + 2 100 € net, 2 enfants (7, 11), propriétaire (crédit)',
    household: hh(
      [
        worker(0, { net: 2300, status: 'fonctionnaire' }),
        worker(0, { net: 2100, status: 'fonctionnaire' }),
      ],
      kids(7, 11),
      OWNER_CREDIT,
    ),
  },
  {
    id: 'cadre-4000',
    family: 'Personnes seules',
    label: 'Cadre du privé seul·e, 4 000 € net, locataire 1 000 € zone 1',
    household: hh([worker(0, { net: 4000, status: 'cadre' })], [], rent(1000, 1)),
  },
];
