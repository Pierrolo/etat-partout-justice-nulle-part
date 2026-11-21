import { describe, expect, it } from 'vitest';
import amendements from '@/data/amendements.json';
import { PARAMS_META } from './engine';
import {
  DEFAULT_AM_STATE,
  effectText,
  filterItems,
  groupItems,
  parseAmState,
  serializeAmState,
  toItems,
  toLiasses,
  toThemes,
  type AmState,
  type RawAmendement,
  type RawLiasse,
  type RawTheme,
} from './amendements-model';

const items = toItems(amendements.amendements as unknown as RawAmendement[]);
const liasses = toLiasses(amendements.meta.liasses as unknown as RawLiasse[]);
const themes = toThemes(amendements.meta.themes as unknown as RawTheme[]);
const themeLabel = (id: string) => themes.find((t) => t.id === id)?.label ?? id;
const st = (p: Partial<AmState>): AmState => ({ ...DEFAULT_AM_STATE, ...p });

describe('amendements-model', () => {
  it('compte 84 amendements : 35 + 40 + 9', () => {
    expect(items).toHaveLength(84);
    expect(items.filter((a) => a.liasse === 'PLF-P1')).toHaveLength(35);
    expect(items.filter((a) => a.liasse === 'PLF-P2')).toHaveLength(40);
    expect(items.filter((a) => a.liasse === 'PLFSS')).toHaveLength(9);
    expect(themes).toHaveLength(13);
    expect(liasses.map((l) => [l.count, l.pages])).toEqual([
      [35, 95],
      [40, 70],
      [9, 24],
    ]);
  });

  it('affiche la version du plan : amendements publiés le 18 novembre 2026', () => {
    expect(amendements.meta.version.label_fr).toBe('Amendements publiés le 18 novembre 2026');
    expect(amendements.meta.version.date_iso).toBe('2026-11-18');
    // the same wording as the simulator's result page (engine PARAMS_META)
    expect(amendements.meta.version.label_fr).toBe(PARAMS_META.planVersionLabel);
    // et le libellé affiché sur les pages, le même que le pied de page du simulateur (PDF des 17 et 18 novembre)
    expect(amendements.meta.version.published_label_fr).toBe(
      'Amendements publiés les 17 et 18 novembre 2026',
    );
    expect(amendements.meta.version.published_label_fr).toBe(PARAMS_META.planPublishedLabel);
    expect(amendements.meta.version.date_iso).toBe(PARAMS_META.planVersionDate);
  });

  it('renvoie chaque date à la page du PDF qui contient la phrase citée', () => {
    for (const a of items) {
      for (const d of a.dates) {
        expect(d.pdfUrl.endsWith(`#page=${d.pdfPage}`), a.id).toBe(true);
        expect(d.pdfPage, a.id).toBeGreaterThanOrEqual(a.pdfPage);
      }
    }
    // PLF-P1 n° 28 : le texte commence page 76 ; PLF-P2 n° 26 : page 47 ; PLFSS n° 9 : page 23
    expect(items.find((a) => a.id === 'PLF-P1-28')!.pdfPage).toBe(76);
    expect(items.find((a) => a.id === 'PLF-P2-26')!.pdfPage).toBe(47);
    expect(items.find((a) => a.id === 'PLFSS-9')!.pdfPage).toBe(23);
  });

  it('résume fidèlement les amendements nouveaux ou modifiés en novembre 2026', () => {
    const r = (id: string) => items.find((a) => a.id === id)!.summary;
    expect(r('PLF-P1-28')).toMatch(/minorée de 3.300.€/);
    // la majoration d'invalidité (+6 600 €) demeure ; la pension n'est plus majorée de 3 300 €
    expect(r('PLF-P1-28')).not.toMatch(/majoré\S* de 3.300/);
    expect(r('PLF-P1-22')).toMatch(/cinquante-quatre/);
    expect(r('PLF-P1-25')).toMatch(/soixante-douze/);
    expect(r('PLF-P1-35')).toMatch(/troisième exercice/);
    expect(r('PLFSS-9')).toMatch(/vingt et une contributions/);
    expect(r('PLF-P2-26')).toMatch(
      /24 mois, plus un mois par trimestre|24 mois plus un mois par trimestre/,
    );
    expect(r('PLF-P2-26')).not.toMatch(/1 à 7 ans/);
    expect(r('PLF-P2-33')).toMatch(/enfant en bas âge ou atteint d['’]une incapacité/);
  });

  it('groupe par liasse puis par thème sans rien perdre', () => {
    for (const mode of ['liasse', 'theme'] as const) {
      const groups = groupItems(items, mode, liasses, themes);
      expect(groups.reduce((n, g) => n + g.items.length, 0)).toBe(84);
    }
    const byLiasse = groupItems(items, 'liasse', liasses, themes);
    expect(byLiasse.map((g) => g.key)).toEqual(['PLF-P1', 'PLF-P2', 'PLFSS']);
    const nums = byLiasse[0]!.items.map((a) => a.number);
    expect([...nums].sort((a, b) => a - b)).toEqual(nums);
  });

  it('cherche sans tenir compte des accents, par mot ou par numéro', () => {
    const r1 = filterItems(items, st({ q: 'TITRES RESTAURANT' }), themeLabel);
    expect(r1.map((a) => a.id)).toContain('PLF-P1-2');
    const r2 = filterItems(items, st({ q: 'aide fondamentale' }), themeLabel);
    expect(r2.length).toBeGreaterThan(1);
    const r3 = filterItems(items, st({ q: 'PLFSS n° 3' }), themeLabel);
    expect(r3.map((a) => a.id)).toContain('PLFSS-3');
    expect(filterItems(items, st({ q: 'zzzzqqqq' }), themeLabel)).toHaveLength(0);
  });

  it('combine liasse, thème et recherche', () => {
    expect(filterItems(items, st({ liasses: ['PLFSS'] }), themeLabel)).toHaveLength(9);
    expect(filterItems(items, st({ theme: 'credits_etat' }), themeLabel)).toHaveLength(23);
    expect(
      filterItems(items, st({ liasses: ['PLF-P1'], theme: 'credits_etat' }), themeLabel),
    ).toHaveLength(0);
  });

  it('dit ce que le texte écrit de la date d’effet, rien de plus', () => {
    expect(effectText({ from: null, to: null })).toMatch(/Aucune date/);
    expect(effectText({ from: '2027-01-01', to: '2027-01-01' })).toBe(
      'Prend effet le 1er janvier 2027.',
    );
    expect(effectText({ from: '2027-01-01', to: '2029-01-01' })).toContain(
      'dernier le 1er janvier 2029',
    );
  });

  it('fait l’aller-retour dans le fragment d’URL et ignore l’inconnu', () => {
    const s = st({ q: 'dons', liasses: ['PLF-P1', 'PLFSS'], theme: 'niches', group: 'theme' });
    const ids = themes.map((t) => t.id);
    expect(parseAmState(serializeAmState(s), ids)).toEqual(s);
    expect(serializeAmState(DEFAULT_AM_STATE)).toBe('');
    const bad = parseAmState('liasse=XX,PLFSS&theme=inconnu&par=zz', ids);
    expect(bad).toEqual(st({ liasses: ['PLFSS'] }));
  });
});
