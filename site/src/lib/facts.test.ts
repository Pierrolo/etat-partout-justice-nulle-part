import { describe, expect, it } from 'vitest';
import { chip, conflicts, datasetChip, fact, num, uiTier, workbookPlace } from './facts';
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
  it('names the sheet and the cell of the authors’ workbook in the visible label', () => {
    expect(chip('actifs_a_restituer_md').label).toBe(
      'Chiffrage publié · Input Capitalisation, C10',
    );
    // a manual label that already names the sheet only gets the cell
    expect(chip('actifs_a_restituer_md', { label: 'Classeur, Input Capitalisation' }).label).toBe(
      'Classeur, Input Capitalisation · C10',
    );
    // a third-party statistic keeps its own label unless asked for the workbook place
    expect(chip('dep_total_2024_md').label).toBe('Insee');
    expect(chip('dep_total_2024_md', { workbook: true }).label).toMatch(
      /^Insee \(repris dans le chiffrage\) · Graph1672Md, [A-Z]+\d+$/,
    );
    expect(
      workbookPlace('Synthèse Chiffres Résolution_0910.xlsx › Refonte fiscalité › C3'),
    ).toEqual({
      sheet: 'Refonte fiscalité',
      cell: 'C3',
    });
    expect(workbookPlace('france-resolution.fr')).toBeNull();
    expect(
      datasetChip({ kind: 'workbook', ref: 'X.xlsx › GraphAgences › H2:I20', url: null }).label,
    ).toBe('Chiffrage publié · GraphAgences, H2:I20');
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
