import { describe, expect, it } from 'vitest';
import niches from '@/data/niches.json';
import {
  DEFAULT_STATE,
  PLAN_IDS,
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
    const locaux = rows.find((r) => r.plan === 'supprimee' && r.tax === 'locaux' && !r.planGroup)!;
    expect(whenOf(locaux).anchor).toBeNull();
    // calendriers propres : dons et épargne ne prennent pas la date « cas général »
    const dons = rows.find((r) => r.id === '110201')!;
    expect(whenOf(dons).text).toContain('Moitié');
    const epargne = rows.find((r) => r.cat === 'epargne' && r.plan === 'supprimee')!;
    expect(whenOf(epargne).anchor).toBe('2027-07-01');
  });
});

describe('niches-model: ce que dit le texte de l’amendement n° 1 (novembre 2026)', () => {
  const byId = (id: string) => rows.find((r) => r.id === id)!;

  it('Pacte Dutreil : supprimé au 1er janvier 2027 (IV.C bis), pas en trois ans', () => {
    const r = byId('520110');
    expect(r.plan).toBe('supprimee');
    expect(r.planGroup).toBe('Cbis');
    expect(r.planClasseur).toBe('trois-ans');
    expect(whenOf(r).text).toContain('1er janvier 2027');
  });

  it('les 12 niches agricoles ou de coopératives du IV.E sont supprimées par tiers', () => {
    const ids = [
      '300101',
      '300102',
      '60102',
      '60104',
      '120147',
      '300110',
      '300208',
      '530208',
      '60202',
      '300109',
      '500101',
      '530216',
    ];
    for (const id of ids) {
      const r = byId(id);
      expect(r.plan, id).toBe('trois-ans');
      expect(r.planGroup, id).toBe('E');
      expect(r.planClasseur, id).toBe('supprimee');
      expect(whenOf(r).text, id).toMatch(/tiers/);
    }
  });

  it('garde d’enfants : la même lecture (par tiers) sur la page niches et sur la page calendrier', () => {
    const r = byId('110203');
    expect(r.plan).toBe('trois-ans');
    expect(r.planClasseur).toBe('aide-fondamentale');
    expect(r.planInferred).toBe(true);
    expect(byId('110246').plan).toBe('trois-ans'); // emploi à domicile : même groupe
  });

  it('les niches de l’impôt sur le revenu du IV.C sont datées de l’impôt de 2028, pas « dès 2027 »', () => {
    const ids = [
      '110102',
      '110103',
      '110107',
      '100202',
      '140122',
      '150114',
      '150117',
      '150120',
      '150515',
      '150518',
      '190208',
      '150121',
      '150210',
      '150211',
      '150406',
      '150705',
      '150706',
      '150707',
      '150710',
    ];
    for (const id of ids) {
      const r = byId(id);
      expect(r.planGroup, id).toBe('C');
      expect(whenOf(r).text, id).toContain('2028');
      expect(whenOf(r).text, id).not.toMatch(/^Dès 2027/);
    }
  });

  it('dons : IV.F, moitié au 1er juillet 2027 puis plus rien, y compris l’abattement du 788-III', () => {
    for (const id of ['110201', '210309', '440201', '520114']) {
      expect(byId(id).planGroup, id).toBe('F');
      expect(whenOf(byId(id)).text, id).toContain('Moitié');
    }
  });

  it('signale chaque désaccord avec le classeur sans le cacher', () => {
    const conflicts = rows.filter((r) => r.planConflict);
    expect(conflicts).toHaveLength(37); // 17 d’octobre + TVA (8) + outre-mer (10) + 110240 + 120124
    expect(conflicts.every((r) => r.planClasseur && r.planClasseur !== r.plan)).toBe(true);
    expect(rows.filter((r) => !r.planConflict).every((r) => r.planClasseur === null)).toBe(true);
  });
});

describe('niches-model: TVA, outre-mer et lectures par la nature (amendement n° 1, novembre 2026)', () => {
  const byId = (id: string) => rows.find((r) => r.id === id)!;
  const plan = (p: string) => rows.filter((r) => r.plan === p);
  const cost = (rs: typeof rows) => rs.reduce((n, r) => n + (costOf(r, 2024) ?? 0), 0);

  it('répartit les 465 niches en sept effets, qui somment au coût total', () => {
    expect(PLAN_IDS).toHaveLength(7);
    expect(rows.every((r) => PLAN_IDS.includes(r.plan))).toBe(true);
    expect(Object.fromEntries(PLAN_IDS.map((p) => [p, [plan(p).length, cost(plan(p))]]))).toEqual({
      supprimee: [327, 65121],
      'trois-ans': [26, 11489],
      'aide-fondamentale': [6, 3522],
      partielle: [2, 173],
      maintenue: [6, 526],
      'outre-mer': [16, 3522],
      eteinte: [82, 5053],
    });
    expect(cost(rows)).toBe(89406);
  });

  it('TVA : 22 lignes nommées au III bis sont supprimées au 1er juillet 2027', () => {
    const named = rows.filter((r) => r.planGroup === 'D3bis');
    expect(named).toHaveLength(22);
    expect(cost(named)).toBe(8330);
    for (const r of named) {
      expect(r.plan, r.id).toBe('supprimee');
      expect(whenOf(r).anchor, r.id).toBe('2027-07-01');
      expect(r.planNote, r.id).toContain('III bis');
    }
    // « Taux de 5,5 % pour les droits d’entrée aux réunions sportives » n’est pas une niche d’outre-mer
    expect(byId('730224').cat).toBe('tva');
  });

  it('TVA : six exonérations et régimes particuliers relèvent de la règle générale (IV.D)', () => {
    for (const id of ['720106', '720107', '720108', '720207', '740105', '740107']) {
      const r = byId(id);
      expect(r.plan, id).toBe('supprimee');
      expect(r.planGroup, id).toBe('D');
      expect(r.planNote, id).toContain('II, 3°');
    }
  });

  it('TVA : six taux non nommés sont maintenus par le II, 4° : un conflit affiché, pas une suppression', () => {
    for (const id of ['730208', '730214', '730218', '730230', '730232', '730235']) {
      const r = byId(id);
      expect(r.plan, id).toBe('maintenue');
      expect(r.planConflict, id).toBe(true);
      expect(r.planClasseur, id).toBe('supprimee');
      expect(r.planExposeConflict, id).toBe(true);
      expect(whenOf(r).anchor, id).toBeNull();
      expect(whenOf(r).text, id).toMatch(/conflit/);
      expect(r.planNote, id).toMatch(/n° 21/);
    }
  });

  it('TVA : deux taux ne sont nommés qu’en partie', () => {
    for (const id of ['730207', '730227']) {
      const r = byId(id);
      expect(r.plan, id).toBe('partielle');
      expect(r.planExposeConflict, id).toBe(true);
      expect(whenOf(r).text, id).toMatch(/III bis/);
    }
  });

  it('outre-mer : dix niches « supprimées » du classeur sont hors du champ (II, dernier alinéa)', () => {
    const ids = [
      '50109',
      '60108',
      '90108',
      '110302',
      '210322',
      '500102',
      '550105',
      '710109',
      '710110',
      '990202',
    ];
    for (const id of ids) {
      const r = byId(id);
      expect(r.plan, id).toBe('outre-mer');
      expect(r.planClasseur, id).toBe('supprimee');
      expect(r.planConflict, id).toBe(true);
      expect(whenOf(r).anchor, id).toBeNull();
    }
    expect(plan('outre-mer')).toHaveLength(16); // + les six « flux OM » du classeur
    // les avantages d’investisseurs non domiciliés restent dans le champ ; 110256, 320136, 320146 : n° 1 III 135° et n° 18
    for (const id of [
      '110210',
      '110224',
      '110260',
      '320113',
      '210325',
      '110256',
      '320136',
      '320146',
    ]) {
      expect(byId(id).plan, id).toBe('supprimee');
    }
    expect(byId('320136').planGroup).toBe('B18');
    expect(byId('110256').planGroup).toBe('B');
  });

  it('110240 suit l’amendement n° 8 (par tiers), 120124 le cas général du IV.A, 60203 est par tiers (inféré)', () => {
    const remplacement = byId('110240');
    expect(remplacement.plan).toBe('trois-ans');
    expect(remplacement.planGroup).toBe('E8');
    expect(remplacement.planClasseur).toBe('supprimee');
    expect(whenOf(remplacement).text).toMatch(/tiers/);
    const detaches = byId('120124');
    expect(detaches.plan).toBe('supprimee');
    expect(detaches.planGroup).toBe('A');
    expect(detaches.planClasseur).toBe('trois-ans');
    expect(detaches.planInferred).toBe(true);
    expect(whenOf(detaches).text).toContain('2026');
    const jeunes = byId('60203');
    expect(jeunes.plan).toBe('trois-ans');
    expect(jeunes.planInferred).toBe(true);
    expect(jeunes.planConflict).toBe(false);
    expect(byId('110203').planInferred).toBe(true);
  });

  it('le cas général est le IV.A (impôt de 2026), pas 2028', () => {
    const generic = rows.filter(
      (r) =>
        r.plan === 'supprimee' &&
        !r.planGroup &&
        r.tax === 'ir' &&
        r.cat !== 'epargne' &&
        !['110201', '210309', '440201'].includes(r.id),
    );
    expect(generic.length).toBeGreaterThan(10);
    for (const r of generic) {
      expect(whenOf(r).text, r.id).toContain('IV.A');
      expect(whenOf(r).text, r.id).toContain('2026');
    }
    const raw = niches.niches.find(
      (n) =>
        n.resolution.plan_texte.methode === 'non rapproché' &&
        n.resolution.plan_texte.note_fr?.startsWith('Aucun numéro'),
    )!;
    expect(raw.resolution.plan_texte.note_fr).toContain('IV.A');
    expect(raw.resolution.plan_texte.note_fr).not.toContain('au titre de 2028');
  });
});
