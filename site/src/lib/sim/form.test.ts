import { describe, expect, it } from 'vitest';
import { DEFAULT_HYPOTHESES } from '@/lib/engine';
import {
  asksChildSupport,
  DEFAULT_HYP,
  emptyAdult,
  emptyFormState,
  formToHousehold,
  hasExtras,
  householdToForm,
  missingLabels,
  newChildId,
  stepOfError,
  type FormState,
} from './form';

/** A complete, valid form: one 35-year-old private-sector employee, tenant. */
const filled = (): FormState => {
  const f = emptyFormState();
  f.couple = false;
  f.adults[0] = emptyAdult({
    age: 35,
    activity: 'salarie',
    salaryAmount: 1700,
    salaryStatus: 'prive',
  });
  f.housing = { status: 'locataire', rentMonthly: 600, zone: 2 };
  return f;
};

describe('the empty form answers nothing', () => {
  it('has no pre-filled age, salary, status, marital status, housing or zone', () => {
    const f = emptyFormState();
    expect(f.couple).toBeNull();
    expect(f.marriedOrPacs).toBeNull();
    expect(f.adults[0].age).toBeNull();
    expect(f.adults[0].activity).toBeNull();
    expect(f.adults[0].salaryAmount).toBeNull();
    expect(f.adults[0].salaryStatus).toBeNull();
    expect(f.housing).toEqual({ status: null, rentMonthly: null, zone: null });
    expect(f.children).toEqual([]);
  });

  it('is not a valid household: nothing can be computed before answering', () => {
    const { household, errors } = formToHousehold(emptyFormState());
    expect(household).toBeNull();
    expect(Object.keys(errors)).toEqual(expect.arrayContaining(['foyer.couple', 'housing.status']));
  });

  it('lists what is missing in plain words, in form order', () => {
    const f = emptyFormState();
    f.couple = false;
    const labels = missingLabels(formToHousehold(f).errors);
    expect(labels).toEqual(['votre âge', 'votre activité', 'votre logement']);
  });

  it('keeps the same hypotheses defaults as the engine (the form never needs the engine to start)', () => {
    expect(DEFAULT_HYP).toEqual(DEFAULT_HYPOTHESES);
  });
});

describe('formToHousehold', () => {
  it('turns a complete form into the engine household', () => {
    const { household, errors } = formToHousehold(filled());
    expect(errors).toEqual({});
    expect(household).toMatchObject({
      adults: [
        {
          age: 35,
          activity: 'salarie',
          disability: 'none',
          salary: { amount: 1700, basis: 'net', status: 'prive' },
        },
      ],
      marriedOrPacs: false,
      children: [],
      housing: { status: 'locataire', rentMonthly: 600, zone: 2 },
      benefits: { nonRecours: false },
    });
  });

  it('a couple must say whether it is married or pacsed: no default', () => {
    const f = filled();
    f.couple = true;
    f.adults[1] = emptyAdult({ age: 33, activity: 'inactif' });
    expect(formToHousehold(f).errors['foyer.married']).toMatch(/marié·e ou pacsé·e/);
    f.marriedOrPacs = false;
    const { household, errors } = formToHousehold(f);
    expect(errors).toEqual({});
    expect(household?.adults).toHaveLength(2);
    expect(household?.marriedOrPacs).toBe(false);
  });

  it('ignores the second adult and the marital status when alone', () => {
    const f = { ...filled(), marriedOrPacs: true };
    const h = formToHousehold(f).household!;
    expect(h.adults).toHaveLength(1);
    expect(h.marriedOrPacs).toBe(false);
  });

  it('a salaried adult must pick a status (no hidden « privé non-cadre »)', () => {
    const f = filled();
    f.adults[0] = { ...f.adults[0], salaryStatus: null };
    expect(formToHousehold(f).errors['adult0.status']).toBeDefined();
  });

  it('gives friendly French messages, keyed by field, with the partner worded as « son »', () => {
    const f = filled();
    f.couple = true;
    f.marriedOrPacs = true;
    f.adults[0] = { ...f.adults[0], age: null, salaryAmount: null };
    f.adults[1] = emptyAdult({ activity: 'salarie', salaryStatus: 'cadre' });
    f.children = [{ id: newChildId(), age: 30, aeeh: false, cmi: false }];
    f.housing = { ...f.housing, rentMonthly: null };
    const { household, errors } = formToHousehold(f);
    expect(household).toBeNull();
    expect(errors['adult0.age']).toMatch(/Indiquez votre âge/);
    expect(errors['adult0.salary']).toMatch(/votre salaire mensuel/);
    expect(errors['adult1.age']).toMatch(/âge de votre conjoint/);
    expect(errors['adult1.salary']).toMatch(/son salaire mensuel/);
    expect(errors['child0.age']).toMatch(/entre 0 et 24 ans/);
    expect(errors['housing.rent']).toMatch(/loyer mensuel/);
  });

  it('rejects an annual salary typed as monthly', () => {
    const f = filled();
    f.adults[0] = { ...f.adults[0], salaryAmount: 250_000 };
    expect(formToHousehold(f).errors['adult0.salary']).toMatch(/montant annuel/);
  });

  it('retirees need a pension, not a salary, a status or a start year', () => {
    const f = filled();
    f.adults[0] = emptyAdult({ age: 74, activity: 'retraite' });
    expect(formToHousehold(f).errors['adult0.pension']).toBeDefined();
    f.adults[0] = { ...f.adults[0], pensionAmount: 980 };
    const h = formToHousehold(f).household!;
    expect(h.adults[0].pension).toEqual({ amount: 980, basis: 'net', startYear: 2020 });
    expect(h.adults[0].salary).toBeUndefined();
  });

  it('unemployed: say whether benefit is received; the amount only when « oui »', () => {
    const f = filled();
    f.adults[0] = emptyAdult({ age: 40, activity: 'chomage' });
    expect(formToHousehold(f).errors['adult0.are']).toBeDefined();
    f.adults[0] = { ...f.adults[0], areOn: false };
    expect(formToHousehold(f).household?.adults[0].unemployment).toBeUndefined();
    f.adults[0] = { ...f.adults[0], areOn: true };
    expect(formToHousehold(f).errors['adult0.are']).toBeDefined();
    f.adults[0] = { ...f.adults[0], areMonthly: 1100 };
    expect(formToHousehold(f).household?.adults[0].unemployment).toEqual({ areMonthly: 1100 });
  });

  it('dirigeant assimilé salarié is computed; TNS is passed on as such (the engine flags it unsupported)', () => {
    const f = filled();
    f.adults[0] = { ...f.adults[0], salaryStatus: 'dirigeant_assimile' };
    expect(formToHousehold(f).household?.adults[0].salary?.status).toBe('dirigeant_assimile');
    f.adults[0] = { ...f.adults[0], salaryStatus: 'tns', salaryAmount: null };
    const { household, errors } = formToHousehold(f);
    expect(errors).toEqual({});
    expect(household?.adults[0].salary?.status).toBe('tns');
  });

  it('a lone parent of a child under 20 must say whether child support is received', () => {
    const f = filled();
    f.children = [{ id: newChildId(), age: 9, aeeh: false, cmi: false }];
    expect(asksChildSupport(f)).toBe(true);
    expect(formToHousehold(f).errors['foyer.childSupport']).toBeDefined();
    f.childSupport = { received: false, monthly: null };
    expect(formToHousehold(f).household?.benefits.childSupportReceivedMonthly).toBeUndefined();
    f.childSupport = { received: true, monthly: null };
    expect(formToHousehold(f).errors['childSupport.amount']).toBeDefined();
    f.childSupport = { received: true, monthly: 250 };
    expect(formToHousehold(f).household?.benefits.childSupportReceivedMonthly).toBe(250);
    // not asked of a couple, nor when every child is an adult
    expect(asksChildSupport({ ...f, couple: true })).toBe(false);
    f.children = [{ id: newChildId(), age: 22, aeeh: false, cmi: false }];
    expect(asksChildSupport(f)).toBe(false);
  });

  it('childcare: mode and cost only count for a child under 6; micro-crèche is a mode', () => {
    const f = filled();
    f.children = [{ id: newChildId(), age: 2, aeeh: false, cmi: false }];
    f.childSupport = { received: false, monthly: null };
    f.extras = { ...f.extras, childcare: 'micro_creche', childcareCostMonthly: 900 };
    expect(formToHousehold(f).household?.extras).toEqual({
      childcare: 'micro_creche',
      childcareCostMonthly: 900,
    });
    // blank cost: the engine applies its default and warns
    f.extras.childcareCostMonthly = null;
    expect(formToHousehold(f).household?.extras).toEqual({ childcare: 'micro_creche' });
    f.children = [{ id: newChildId(), age: 8, aeeh: false, cmi: false }];
    expect(formToHousehold(f).household?.extras).toBeUndefined();
  });

  it('the zone « Je ne sais pas » gives zone 2; the zone is required for a tenant', () => {
    const f = filled();
    f.housing = { status: 'locataire', rentMonthly: 500, zone: null };
    expect(formToHousehold(f).errors['housing.zone']).toBeDefined();
    f.housing.zone = 'inconnue';
    expect(formToHousehold(f).household?.housing.zone).toBe(2);
    f.housing.zone = 3;
    expect(formToHousehold(f).household?.housing.zone).toBe(3);
  });

  it('the CAF override only applies when asked for and not combined with « je ne touche pas ces aides »', () => {
    const f = { ...filled(), cafOverrideOn: true, cafOverrideMonthly: 320 };
    expect(formToHousehold(f).household?.benefits).toEqual({
      nonRecours: false,
      cafOverrideMonthly: 320,
    });
    expect(formToHousehold({ ...f, nonRecours: true }).household?.benefits).toEqual({
      nonRecours: true,
    });
    expect(formToHousehold({ ...f, cafOverrideMonthly: null }).errors.caf).toMatch(/CAF/);
  });

  it('keeps work ratio and AEEH only when they differ from the defaults', () => {
    const f = filled();
    f.adults[0] = { ...f.adults[0], workRatio: 0.5 };
    f.children = [{ id: newChildId(), age: 8, aeeh: true, cmi: false }];
    f.childSupport = { received: false, monthly: null };
    const h = formToHousehold(f).household!;
    expect(h.adults[0].salary?.workRatio).toBe(0.5);
    expect(h.children).toEqual([{ age: 8, aeeh: true }]);
    f.children = [{ id: newChildId(), age: 8, aeeh: true, cmi: true }];
    expect(formToHousehold(f).household!.children).toEqual([
      { age: 8, aeeh: true, cmiInvalidite: true },
    ]);
  });

  it('« séparé·e récemment » only applies to a lone parent', () => {
    const f = filled();
    f.isolementRecent = true;
    expect(formToHousehold(f).household!.benefits.isolementRecent).toBeUndefined(); // no child
    f.children = [{ id: newChildId(), age: 5, aeeh: false, cmi: false }];
    f.childSupport = { received: false, monthly: null };
    expect(formToHousehold(f).household!.benefits.isolementRecent).toBe(true);
  });
});

describe('where an error lives', () => {
  it('maps every error key to one of the four steps', () => {
    expect(stepOfError('foyer.couple')).toBe('foyer');
    expect(stepOfError('child1.age')).toBe('foyer');
    expect(stepOfError('childSupport.amount')).toBe('foyer');
    expect(stepOfError('adult1.salary')).toBe('adults');
    expect(stepOfError('housing.zone')).toBe('logement');
    expect(stepOfError('caf')).toBe('aides');
    expect(stepOfError('extras.dons')).toBe('aides');
  });
});

describe('householdToForm', () => {
  it('round-trips a household through the form', () => {
    const f = filled();
    f.couple = true;
    f.marriedOrPacs = true;
    f.adults[1] = emptyAdult({
      age: 41,
      activity: 'salarie',
      salaryAmount: 2100,
      salaryStatus: 'cadre',
      disability: 'aah_50_79',
    });
    f.children = [
      { id: newChildId(), age: 3, aeeh: false, cmi: false },
      { id: newChildId(), age: 15, aeeh: true, cmi: true },
    ];
    f.extras = { ...f.extras, childcare: 'assistante_maternelle', childcareCostMonthly: 700 };
    f.housing = { status: 'locataire', rentMonthly: 780, zone: 1 };
    f.extras.donsAnnual = 200;
    const first = formToHousehold(f).household!;
    const second = formToHousehold(householdToForm(first)).household!;
    expect(second).toEqual(first);
  });

  it('round-trips a lone parent who receives child support, and a retiree', () => {
    const f = filled();
    f.children = [{ id: newChildId(), age: 9, aeeh: false, cmi: false }];
    f.childSupport = { received: true, monthly: 180 };
    const first = formToHousehold(f).household!;
    expect(formToHousehold(householdToForm(first)).household).toEqual(first);
    const r = filled();
    r.adults[0] = emptyAdult({ age: 74, activity: 'retraite', pensionAmount: 980 });
    r.housing = { status: 'proprietaire', rentMonthly: null, zone: null };
    const retiree = formToHousehold(r).household!;
    expect(formToHousehold(householdToForm(retiree)).household).toEqual(retiree);
  });

  it('opens « Affiner » only when something was refined', () => {
    expect(hasExtras(emptyFormState())).toBe(false);
    const f = filled();
    f.extras.donsAnnual = 120;
    expect(hasExtras(f)).toBe(true);
  });
});
