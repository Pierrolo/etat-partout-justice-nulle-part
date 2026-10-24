import { describe, expect, it } from 'vitest';
import { chip, conflicts, fact, num, uiTier } from './facts';
import { readingTime } from './reading';

describe('facts helper', () => {
  it('reads numeric facts', () => {
    expect(num('dep_total_2024_md')).toBeCloseTo(1671.794, 3);
    expect(
      num('va_heure_etat_eur') + num('va_heure_capital_eur') + num('va_heure_salaire_net_eur'),
    ).toBe(num('va_heure_total_eur'));
  });
  it('throws on text values and unknown ids', () => {
    expect(() => num('dep_prise_sur_revenus_manifeste')).toThrow();
    // @ts-expect-error unknown id must not type-check
    expect(() => fact('nope')).toThrow();
  });
  it('maps tiers and builds source chips', () => {
    expect(uiTier('loi')).toBe('law');
    expect(uiTier('annonce')).toBe('announced');
    expect(uiTier('donnee')).toBeUndefined();
    const c = chip('eu_dep_pib_fr_2024_pct');
    expect(c.label).toBe('Eurostat');
    expect(c.href).toMatch(/^https:\/\/ec\.europa\.eu/);
    expect(c.year).toBe(2024);
  });
  it('exposes conflicts', () => {
    expect(conflicts('eu_dep_pib_fr_2024_pct').map((c) => c.group)).toContain('record_mondial');
  });
});

describe('readingTime', () => {
  it('derives hours and full-time years from words', () => {
    const r = readingTime(num('droit_mots_2026'));
    expect(r.hours).toBeCloseTo(3255.6, 0);
    expect(r.fullTimeYears).toBeGreaterThan(2);
    expect(r.fullTimeYears).toBeLessThan(2.1);
  });
});
