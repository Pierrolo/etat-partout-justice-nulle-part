import golden from '../../../research/baseline/golden-cases.json' with { type: 'json' };
import type { Adult, Household } from '../../src/types.ts';

export interface GoldenCase {
  id: string;
  label: string;
  inputs: {
    couple: boolean;
    adults: Array<{
      age: number;
      status: string;
      gross_monthly: number;
      work_ratio: number;
      pension_gross_monthly?: number;
    }>;
    children_ages: number[];
    housing: { status: string; rent_monthly?: number; zone?: 1 | 2 | 3 };
    single_parent_recent_isolation: boolean;
    childcare_expenses_annual_per_child_under6: number;
  };
  outputs: {
    adults: Array<Record<string, number | string>>;
    household_monthly: Record<string, number>;
    tax_annual: Record<string, number>;
    benefits_annual: Record<string, number>;
    disposable_income_monthly_steady_state: number;
  };
}

export const GOLDEN: GoldenCase[] = (golden as unknown as { cases: GoldenCase[] }).cases;

export function toHousehold(c: GoldenCase): Household {
  const i = c.inputs;
  const adults = i.adults.map((a): Adult => {
    if (a.status === 'salarie')
      return {
        age: a.age,
        activity: 'salarie',
        disability: 'none',
        salary: {
          amount: a.gross_monthly,
          basis: 'brut',
          status: 'prive',
          workRatio: a.work_ratio,
        },
      };
    if (a.status === 'retraite')
      return {
        age: a.age,
        activity: 'retraite',
        disability: 'none',
        pension: { amount: a.pension_gross_monthly ?? 0, basis: 'brut', startYear: 2015 },
      };
    if (a.status === 'aah') return { age: a.age, activity: 'inactif', disability: 'aah_80' };
    return { age: a.age, activity: 'inactif', disability: 'none' };
  }) as Household['adults'];
  const nU6 = i.children_ages.filter((a) => a < 6).length;
  const h: Household = {
    adults,
    marriedOrPacs: i.couple,
    children: i.children_ages.map((age) => ({ age })),
    housing:
      i.housing.status === 'locataire'
        ? {
            status: 'locataire',
            rentMonthly: i.housing.rent_monthly ?? 0,
            zone: i.housing.zone ?? 2,
          }
        : { status: i.housing.status === 'proprietaire' ? 'proprietaire' : 'gratuit' },
    benefits: { nonRecours: false, isolementRecent: i.single_parent_recent_isolation },
  };
  if (i.childcare_expenses_annual_per_child_under6 > 0 && nU6 > 0)
    h.extras = {
      childcare: 'creche',
      childcareCostMonthly: (i.childcare_expenses_annual_per_child_under6 * nU6) / 12,
    };
  return h;
}
