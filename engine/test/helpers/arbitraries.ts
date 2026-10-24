import { fc } from '@fast-check/vitest';
import type { Adult, Child, Household, Hypotheses, Period } from '../../src/types.ts';

const money = (max: number) => fc.integer({ min: 0, max: max * 100 }).map((x) => x / 100);

export const salaryArb = fc.record(
  {
    amount: money(9000),
    basis: fc.constantFrom('net' as const, 'brut' as const),
    status: fc.constantFrom('prive' as const, 'cadre' as const, 'fonctionnaire' as const),
    workRatio: fc.constantFrom(0.5, 0.8, 1),
  },
  { requiredKeys: ['amount', 'basis', 'status'] },
);

export const adultArb = (
  opts: { pensionBasis?: Array<'net' | 'brut'> } = {},
): fc.Arbitrary<Adult> =>
  fc
    .record({
      age: fc.integer({ min: 18, max: 90 }),
      activity: fc.constantFrom(
        'salarie' as const,
        'chomage' as const,
        'retraite' as const,
        'etudiant' as const,
        'inactif' as const,
      ),
      disability: fc.constantFrom(
        'none' as const,
        'none' as const,
        'aah_80' as const,
        'aah_50_79' as const,
      ),
      salary: salaryArb,
      are: money(2500),
      pension: fc.record({
        amount: money(5000),
        basis: fc.constantFrom(...(opts.pensionBasis ?? (['net', 'brut'] as const))),
        startYear: fc.integer({ min: 2000, max: 2035 }),
      }),
    })
    .map((r) => {
      const a: Adult = { age: r.age, activity: r.activity, disability: r.disability };
      if (r.activity === 'salarie' || r.activity === 'etudiant') a.salary = r.salary;
      if (r.activity === 'chomage') a.unemployment = { areMonthly: r.are };
      if (r.activity === 'retraite') a.pension = r.pension;
      return a;
    });

export const childArb: fc.Arbitrary<Child> = fc.record(
  { age: fc.integer({ min: 0, max: 24 }), aeeh: fc.boolean() },
  { requiredKeys: ['age'] },
);

export const householdArb = (
  opts: { adults?: fc.Arbitrary<Adult>; twoAdults?: boolean; noCafOverride?: boolean } = {},
): fc.Arbitrary<Household> => {
  const adult = opts.adults ?? adultArb();
  const adults = (
    opts.twoAdults ? fc.tuple(adult, adult) : fc.oneof(fc.tuple(adult), fc.tuple(adult, adult))
  ) as fc.Arbitrary<Household['adults']>;
  return fc
    .record({
      adults,
      marriedOrPacs: fc.boolean(),
      children: fc.array(childArb, { maxLength: 4 }),
      housing: fc.oneof(
        fc.record({
          status: fc.constant('locataire' as const),
          rentMonthly: money(1800),
          zone: fc.constantFrom(1 as const, 2 as const, 3 as const),
        }),
        fc.record({
          status: fc.constantFrom(
            'proprietaire' as const,
            'proprietaire_credit' as const,
            'gratuit' as const,
          ),
        }),
      ),
      nonRecours: fc.boolean(),
      caf: opts.noCafOverride ? fc.constant(undefined) : fc.option(money(2500), { nil: undefined }),
      extras: fc.option(
        fc.record(
          {
            childcare: fc.constantFrom(
              'parent' as const,
              'creche' as const,
              'assistante_maternelle' as const,
            ),
            childcareCostMonthly: money(1200),
            emploiDomicileAnnual: money(15000),
            donsAnnual: money(5000),
          },
          { requiredKeys: [] },
        ),
        { nil: undefined },
      ),
    })
    .map((r) => {
      const h: Household = {
        adults: r.adults,
        marriedOrPacs: r.marriedOrPacs,
        children: r.children,
        housing: r.housing,
        benefits: { nonRecours: r.nonRecours },
      };
      if (r.caf !== undefined) h.benefits.cafOverrideMonthly = r.caf;
      if (r.extras !== undefined) h.extras = r.extras;
      return h;
    });
};

export const hypothesesArb: fc.Arbitrary<Hypotheses> = fc.record({
  H1_benefits: fc.constantFrom('replaced' as const, 'differential' as const),
  H2_fraisPro10: fc.boolean(),
  H5_tvaPassThrough: fc.constantFrom(0 as const, 0.5 as const, 1 as const),
  includeTva: fc.boolean(),
});

export const periodArb: fc.Arbitrary<Period> = fc.constantFrom(
  'steady' as const,
  2027 as const,
  2028 as const,
  2030 as const,
);
