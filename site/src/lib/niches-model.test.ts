import { describe, expect, it } from 'vitest';
import niches from '@/data/niches.json';
import {
  DEFAULT_STATE,
  PAGE_SIZE,
  byCategory,
  byTax,
  clampPage,
  costOf,
  filterRows,
  isDefaultState,
  legalLabel,
  normalize,
  pageCount,
  parseState,
  serializeState,
  sortRows,
  summarize,
  toRows,
  topN,
  truncate,
  whenOf,
  type ExplorerState,
  type RawNiche,
} from './niches-model';

const rows = toRows(niches.niches as unknown as RawNiche[]);
const state = (patch: Partial<ExplorerState>): ExplorerState => ({ ...DEFAULT_STATE, ...patch });

describe('niches-model: les données', () => {
  it('compte 465 niches et retrouve les totaux publiés', () => {
    expect(rows).toHaveLength(465);
    expect(summarize(rows, 2024).total).toBe(niches.meta.totals.cost_2024_meur);
    expect(summarize(rows, 2025).total).toBe(niches.meta.totals.cost_2025_meur);
    expect(summarize(rows, 2026).total).toBe(niches.meta.totals.cost_2026_meur);
  });

  it('ne transforme jamais un coût manquant en zéro', () => {
    const missing = rows.filter((r) => costOf(r, 2026) === null);
    expect(missing.length).toBeGreaterThan(100);
    expect(missing.every((r) => r.cost[2] === null)).toBe(true);
    expect(summarize(rows, 2026).unpriced).toBe(missing.length);
  });

  it('classe chaque niche dans une catégorie, un impôt et un effet connus', () => {
    expect(rows.every((r) => r.cat && r.tax && r.plan)).toBe(true);
    const cats = byCategory(rows);
    expect(cats.reduce((n, c) => n + c.count, 0)).toBe(465);
    expect(cats.reduce((n, c) => n + c.total, 0)).toBe(89406);
    expect(byTax(rows).reduce((n, c) => n + c.count, 0)).toBe(465);
    expect(rows.filter((r) => r.plan === 'eteinte')).toHaveLength(82);
    expect(rows.filter((r) => r.menages)).toHaveLength(47);
  });

  it('donne le top 20 du coût 2024 dans l’ordre', () => {
    const top = topN(rows, 2024, 20);
    expect(top).toHaveLength(20);
    const costs = top.map((r) => costOf(r, 2024)!);
    expect([...costs].sort((a, b) => b - a)).toEqual(costs);
    expect(top[0]!.label).toMatch(/recherche/i);
  });
});

describe('niches-model: recherche', () => {
  it('ignore accents, casse, ligatures et apostrophes typographiques', () => {
    expect(normalize('Crédit d’impôt ŒUVRE')).toBe("credit d'impot oeuvre");
    const a = filterRows(rows, state({ q: 'credit d impot recherche' }));
    const b = filterRows(rows, state({ q: 'CRÉDIT D’IMPÔT en faveur de la RECHERCHE' }));
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
    expect(b.map((r) => r.id)).toContain('200302');
    expect(a.map((r) => r.id)).not.toContain('nope');
  });

  it('exige tous les mots (ET) et trouve aussi par référence légale ou identifiant', () => {
    const both = filterRows(rows, state({ q: 'dons réduction' }));
    const one = filterRows(rows, state({ q: 'dons' }));
    expect(both.length).toBeLessThanOrEqual(one.length);
    expect(filterRows(rows, state({ q: '110246' })).map((r) => r.id)).toContain('110246');
    expect(filterRows(rows, state({ q: '81-19' })).length).toBeGreaterThan(0);
    expect(filterRows(rows, state({ q: 'zzzzqqqq' }))).toHaveLength(0);
  });

  it('combine catégories, impôts, effet du plan et « ménages » par ET entre groupes', () => {
    const m = filterRows(rows, state({ menages: true }));
    expect(m).toHaveLength(47);
    const cat = filterRows(rows, state({ cats: ['epargne', 'logement'] }));
    expect(cat.every((r) => r.cat === 'epargne' || r.cat === 'logement')).toBe(true);
    const both = filterRows(rows, state({ cats: ['epargne'], menages: true }));
    expect(both.length).toBeLessThan(cat.length);
    const gone = filterRows(rows, state({ plans: ['eteinte'] }));
    expect(gone).toHaveLength(82);
  });
});

describe('niches-model: tri et pagination', () => {
  it('range par coût décroissant puis croissant, coûts manquants toujours en dernier', () => {
    for (const dir of ['desc', 'asc'] as const) {
      const sorted = sortRows(rows, state({ dir }));
      const firstNull = sorted.findIndex((r) => costOf(r, 2024) === null);
      expect(firstNull).toBeGreaterThan(300);
      expect(sorted.slice(firstNull).every((r) => costOf(r, 2024) === null)).toBe(true);
      const known = sorted.slice(0, firstNull).map((r) => costOf(r, 2024)!);
      const expected = [...known].sort((a, b) => (dir === 'desc' ? b - a : a - b));
      expect(known).toEqual(expected);
    }
  });

  it('trie par nom en français', () => {
    const sorted = sortRows(rows, state({ sort: 'nom', dir: 'asc' }));
    const names = sorted.map((r) => r.label);
    expect(names).toEqual(
      [...names].sort(new Intl.Collator('fr', { sensitivity: 'base', numeric: true }).compare),
    );
  });

  it('borne la page', () => {
    expect(pageCount(465)).toBe(Math.ceil(465 / PAGE_SIZE));
    expect(pageCount(0)).toBe(1);
    expect(clampPage(999, 465)).toBe(pageCount(465));
    expect(clampPage(-3, 465)).toBe(1);
    expect(clampPage(Number.NaN, 465)).toBe(1);
  });
});

describe('niches-model: état dans l’URL', () => {
  it('fait l’aller-retour sans perte et omet les valeurs par défaut', () => {
    expect(serializeState(DEFAULT_STATE)).toBe('');
    const s = state({
      q: 'garde d’enfants',
      cats: ['menages', 'epargne'],
      taxes: ['ir'],
      plans: ['trois-ans'],
      menages: true,
      year: 2026,
      sort: 'nom',
      dir: 'asc',
      page: 3,
    });
    expect(parseState(serializeState(s))).toEqual(s);
    expect(parseState(`#${serializeState(s)}`)).toEqual(s);
    expect(isDefaultState(parseState(''))).toBe(true);
  });

  it('ignore les valeurs inconnues ou hostiles', () => {
    const s = parseState('cat=menages,<script>,xx&annee=1999&tri=bizarre&page=-4&impot=ir,ir');
    expect(s.cats).toEqual(['menages']);
    expect(s.year).toBe(2024);
    expect(s.sort).toBe('cout');
    expect(s.page).toBe(1);
    expect(s.taxes).toEqual(['ir']);
    expect(parseState('q=' + 'a'.repeat(500)).q).toHaveLength(120);
  });
});

describe('niches-model: libellés', () => {
  it('abrège les références légales', () => {
    expect(legalLabel({ code: 'code général des impôts', reference: '81-19°' })).toBe(
      'CGI, art. 81-19°',
    );
    expect(legalLabel({ code: 'BOFIP', reference: 'BOI-RSA-PENS-10-30' })).toBe(
      'BOFiP BOI-RSA-PENS-10-30',
    );
    expect(legalLabel({ code: null, reference: 'Loi n° 2023-1322' })).toBe('Loi n° 2023-1322');
    expect(legalLabel({ code: null, reference: null })).toBeNull();
  });

  it('raccourcit sans couper un mot', () => {
    expect(truncate('court', 20)).toBe('court');
    const t = truncate('Crédit d’impôt au titre de l’emploi d’un salarié à domicile', 30);
    expect(t.endsWith('…')).toBe(true);
    expect(t.length).toBeLessThanOrEqual(30);
  });
});

describe('niches-model: quand ?', () => {
  it('ne donne une date précise que lorsque la source l’écrit', () => {
    const find = (plan: string) => rows.find((r) => r.plan === plan)!;
    expect(whenOf(find('trois-ans')).anchor).toBe('2027-01-01');
    expect(whenOf(find('aide-fondamentale')).anchor).toBe('2028-01-01');
    expect(whenOf(find('eteinte')).anchor).toBeNull();
    expect(whenOf(find('outre-mer')).anchor).toBeNull();
    const tva = rows.find((r) => r.plan === 'supprimee' && r.tax === 'tva')!;
    expect(whenOf(tva).text).toContain('1er juillet 2027');
    const locaux = rows.find((r) => r.plan === 'supprimee' && r.tax === 'locaux')!;
    expect(whenOf(locaux).anchor).toBeNull();
    // calendriers propres : dons et épargne ne prennent pas la date « cas général »
    const dons = rows.find((r) => r.id === '110201')!;
    expect(whenOf(dons).text).toContain('Moitié');
    const epargne = rows.find((r) => r.cat === 'epargne' && r.plan === 'supprimee')!;
    expect(whenOf(epargne).anchor).toBe('2027-07-01');
  });
});
