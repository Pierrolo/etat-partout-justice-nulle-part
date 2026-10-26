import { describe, expect, it } from 'vitest';
import amendements from '@/data/amendements.json';
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
  it('compte 81 amendements : 34 + 39 + 8', () => {
    expect(items).toHaveLength(81);
    expect(items.filter((a) => a.liasse === 'PLF-P1')).toHaveLength(34);
    expect(items.filter((a) => a.liasse === 'PLF-P2')).toHaveLength(39);
    expect(items.filter((a) => a.liasse === 'PLFSS')).toHaveLength(8);
    expect(themes).toHaveLength(13);
  });

  it('groupe par liasse puis par thème sans rien perdre', () => {
    for (const mode of ['liasse', 'theme'] as const) {
      const groups = groupItems(items, mode, liasses, themes);
      expect(groups.reduce((n, g) => n + g.items.length, 0)).toBe(81);
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
    expect(filterItems(items, st({ liasses: ['PLFSS'] }), themeLabel)).toHaveLength(8);
    expect(filterItems(items, st({ theme: 'credits_etat' }), themeLabel)).toHaveLength(22);
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
