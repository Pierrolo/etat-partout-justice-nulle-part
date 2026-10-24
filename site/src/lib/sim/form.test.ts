import { describe, expect, it } from 'vitest';
import {
  defaultFormState,
  formToHousehold,
  hasExtras,
  householdToForm,
  newChildId,
  SMIC_NET_MONTHLY,
  type FormState,
} from './form';

const base = (): FormState => defaultFormState();

describe('formToHousehold', () => {
  it('the default form is a valid household: one 35-year-old private-sector employee at SMIC, tenant zone 2', () => {
    const { household, errors } = formToHousehold(base());
    expect(errors).toEqual({});
    expect(household).toMatchObject({
      adults: [
        {
          age: 35,
          activity: 'salarie',
          disability: 'none',
          salary: { amount: SMIC_NET_MONTHLY, basis: 'net', status: 'prive' },
        },
      ],
      marriedOrPacs: false,
      children: [],
      housing: { status: 'locataire', zone: 2 },
      benefits: { nonRecours: false },
    });
  });

  it('only includes the second adult for a couple, and ignores « marié·e » when single', () => {
    const f = { ...base(), marriedOrPacs: true };
    expect(formToHousehold(f).household?.adults).toHaveLength(1);
    expect(formToHousehold(f).household?.marriedOrPacs).toBe(false);
    const couple = { ...f, couple: true };
    expect(formToHousehold(couple).household?.adults).toHaveLength(2);
    expect(formToHousehold(couple).household?.marriedOrPacs).toBe(true);
  });

  it('gives friendly French messages, keyed by field', () => {
    const f = base();
    f.adults[0] = { ...f.adults[0], age: null, salaryAmount: null };
    f.children = [{ id: newChildId(), age: 30, aeeh: false, cmi: false }];
    f.housing = { ...f.housing, rentMonthly: null };
    const { household, errors } = formToHousehold(f);
    expect(household).toBeNull();
    expect(errors['adult0.age']).toMatch(/Indiquez votre âge/);
    expect(errors['adult0.salary']).toMatch(/salaire mensuel/);
    expect(errors['child0.age']).toMatch(/entre 0 et 24 ans/);
    expect(errors['housing.rent']).toMatch(/loyer mensuel/);
  });

  it('rejects an annual salary typed as monthly', () => {
    const f = base();
    f.adults[0] = { ...f.adults[0], salaryAmount: 250_000 };
    expect(formToHousehold(f).errors['adult0.salary']).toMatch(/montant annuel/);
  });

  it('retirees need a pension and a start year', () => {
    const f = base();
    f.adults[0] = {
      ...f.adults[0],
      activity: 'retraite',
      pensionAmount: 1500,
      pensionStartYear: null,
    };
    expect(formToHousehold(f).errors['adult0.pensionYear']).toBeDefined();
    f.adults[0] = { ...f.adults[0], pensionStartYear: 2019 };
    expect(formToHousehold(f).household?.adults[0].pension).toEqual({
      amount: 1500,
      basis: 'net',
      startYear: 2019,
    });
  });

  it('unemployed: ARE only when « indemnisé·e »', () => {
    const f = base();
    f.adults[0] = { ...f.adults[0], activity: 'chomage', areOn: false };
    expect(formToHousehold(f).household?.adults[0].unemployment).toBeUndefined();
    f.adults[0] = { ...f.adults[0], areOn: true, areMonthly: 1100 };
    expect(formToHousehold(f).household?.adults[0].unemployment).toEqual({ areMonthly: 1100 });
  });

  it('the CAF override only applies when asked for and not combined with « je ne touche pas ces aides »', () => {
    const f = { ...base(), cafOverrideOn: true, cafOverrideMonthly: 320 };
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
    const f = base();
    f.adults[0] = { ...f.adults[0], workRatio: 0.5 };
    f.children = [{ id: newChildId(), age: 8, aeeh: true, cmi: false }];
    const h = formToHousehold(f).household!;
    expect(h.adults[0].salary?.workRatio).toBe(0.5);
    expect(h.children).toEqual([{ age: 8, aeeh: true }]);
    f.children = [{ id: newChildId(), age: 8, aeeh: true, cmi: true }];
    expect(formToHousehold(f).household!.children).toEqual([
      { age: 8, aeeh: true, cmiInvalidite: true },
    ]);
  });

  it('« séparé·e récemment » only applies to a lone parent', () => {
    const f = base();
    f.isolementRecent = true;
    expect(formToHousehold(f).household!.benefits.isolementRecent).toBeUndefined(); // no child
    f.children = [{ id: newChildId(), age: 5, aeeh: false, cmi: false }];
    expect(formToHousehold(f).household!.benefits.isolementRecent).toBe(true);
    expect(
      formToHousehold({ ...f, couple: true }).household!.benefits.isolementRecent,
    ).toBeUndefined();
  });
});

describe('householdToForm', () => {
  it('round-trips a household through the form', () => {
    const f = base();
    f.couple = true;
    f.marriedOrPacs = true;
    f.adults[1] = {
      ...f.adults[1],
      age: 41,
      salaryAmount: 2100,
      salaryStatus: 'cadre',
      disability: 'aah_50_79',
    };
    f.children = [
      { id: newChildId(), age: 3, aeeh: false, cmi: false },
      { id: newChildId(), age: 15, aeeh: true, cmi: true },
    ];
    f.housing = { status: 'locataire', rentMonthly: 780, zone: 1 };
    f.extras.donsAnnual = 200;
    const first = formToHousehold(f).household!;
    const second = formToHousehold(householdToForm(first)).household!;
    expect(second).toEqual(first);
  });

  it('opens « Affiner » only when something was refined', () => {
    expect(hasExtras(base())).toBe(false);
    const f = base();
    f.extras.donsAnnual = 120;
    expect(hasExtras(f)).toBe(true);
  });
});
