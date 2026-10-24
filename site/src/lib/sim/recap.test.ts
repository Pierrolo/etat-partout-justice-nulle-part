import { describe, expect, it } from 'vitest';
import type { Household } from '@/lib/engine-types';
import { buildRecap } from './recap';

const nadia: Household = {
  adults: [
    {
      age: 41,
      activity: 'salarie',
      salary: { amount: 1427, basis: 'net', status: 'prive' },
      disability: 'none',
    },
    {
      age: 43,
      activity: 'salarie',
      salary: { amount: 1700, basis: 'net', status: 'cadre' },
      disability: 'none',
    },
  ],
  marriedOrPacs: false,
  children: [{ age: 12 }],
  housing: { status: 'locataire', rentMonthly: 480, zone: 2 },
  benefits: { nonRecours: false },
};

describe('recap of the answers', () => {
  it('reads a couple with a child back in plain French, each group tied to its step', () => {
    const r = buildRecap(nadia);
    const text = Object.fromEntries(r.map((g) => [g.id, g.text]));
    expect(text.foyer).toContain('En couple, ni marié·e ni pacsé·e');
    expect(text.foyer).toContain('1 enfant à charge (12 ans)');
    expect(text.vous).toContain('41 ans');
    expect(text.vous).toContain('1 427 € net par mois');
    expect(text.conjoint).toContain('cadre');
    expect(text.logement).toContain('Locataire, loyer de 480 € par mois hors charges, zone 2');
    expect(r.map((g) => g.step)).toEqual(['foyer', 'adults', 'adults', 'logement', 'aides']);
  });

  it('mentions child support, childcare and a retiree’s pension', () => {
    const lone: Household = {
      adults: [
        {
          age: 74,
          activity: 'retraite',
          pension: { amount: 980, basis: 'net', startYear: 2015 },
          disability: 'none',
        },
      ],
      marriedOrPacs: false,
      children: [{ age: 3 }],
      housing: { status: 'proprietaire' },
      benefits: { nonRecours: false, childSupportReceivedMonthly: 150 },
      extras: { childcare: 'micro_creche' },
    };
    const text = Object.fromEntries(buildRecap(lone).map((g) => [g.id, g.text]));
    expect(text.foyer).toContain('pension alimentaire reçue');
    expect(text.foyer).toContain('micro-crèche');
    expect(text.foyer).toContain('coût non précisé');
    expect(text.vous).toContain('retraité·e, pension de 980');
    expect(text.logement).toBe('Propriétaire, sans crédit');
  });

  it('uses French typography (no space before « : » left breakable)', () => {
    for (const g of buildRecap(nadia)) expect(g.text).not.toMatch(/\S :/);
  });
});
