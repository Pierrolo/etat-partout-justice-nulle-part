import { describe, expect, it } from 'vitest';
import { NBSP, NNBSP, typo, typoDeep } from './typo';

describe('typo', () => {
  it('met une espace fine insécable avant ; : ! ? et dans les guillemets', () => {
    expect(typo('Et moi, dans tout ça ?')).toBe(`Et moi, dans tout ça${NNBSP}?`);
    expect(typo('Source : le livre ; vraiment !')).toBe(
      `Source${NNBSP}: le livre${NNBSP}; vraiment${NNBSP}!`,
    );
    expect(typo('Le « record mondial » est faux')).toBe(
      `Le «${NNBSP}record mondial${NNBSP}» est faux`,
    );
    expect(typo(`Pourquoi${NBSP}: x`)).toBe(`Pourquoi${NNBSP}: x`);
  });

  it('une espace en tête de texte après un élément ou une expression précède bien la marque', () => {
    expect(typo(' : la législation', { afterInline: true })).toBe(`${NNBSP}: la législation`);
    expect(typo(' : la législation')).toBe(' : la législation');
    expect(typo(' :hover', { afterInline: true })).toBe(' :hover');
  });

  it('ne touche ni au code, ni aux URLs, ni aux ternaires sans espace avant', () => {
    expect(typo('https://exemple.fr/a?b=1&c=2')).toBe('https://exemple.fr/a?b=1&c=2');
    expect(typo('a:hover')).toBe('a:hover');
    expect(typo('a :hover')).toBe('a :hover');
    expect(typo('Que faire ?b')).toBe('Que faire ?b');
  });

  it('colle les unités et regroupe les milliers', () => {
    expect(typo('80 % ou 10 000 € ou 143 Md€')).toBe(
      `80${NBSP}% ou 10${NNBSP}000${NBSP}€ ou 143${NBSP}Md€`,
    );
    expect(typo('1 234 567 personnes')).toBe(`1${NNBSP}234${NNBSP}567 personnes`);
    // une année suivie d’un nombre n’est pas un groupe de milliers
    expect(typo('en 2026 600 foyers')).toBe('en 2026 600 foyers');
    expect(typo('3,5 100 foyers')).toBe('3,5 100 foyers');
  });

  it('typographie les apostrophes entre deux lettres', () => {
    expect(typo("l'État d'aujourd'hui")).toBe('l’État d’aujourd’hui');
    expect(typo("'quoted'")).toBe("'quoted'");
  });

  it('écrit 1er devant un mois', () => {
    expect(typo('au 1 juillet 2027')).toBe('au 1er juillet 2027');
    expect(typo('le 11 juillet')).toBe('le 11 juillet');
    expect(typo('le 1er juillet')).toBe('le 1er juillet');
  });

  it('options réservées aux données', () => {
    expect(typo('Plafond de 10%')).toBe('Plafond de 10%');
    expect(typo('Plafond de 10%', { spaceBeforePercent: true })).toBe(`Plafond de 10${NBSP}%`);
    expect(typo('ADEME - Agence', { enDash: true })).toBe('ADEME – Agence');
  });

  it('est idempotent', () => {
    const s = "Zone euro : 49,4 % du PIB ; « l'État » 1 juillet 10 000 € !";
    expect(typo(typo(s))).toBe(typo(s));
  });

  it('typoDeep traverse objets et tableaux', () => {
    expect(typoDeep({ a: ['x ?', { b: 3 }], c: null })).toEqual({
      a: [`x${NNBSP}?`, { b: 3 }],
      c: null,
    });
  });
});

describe('typo : adresses web (R2-01)', () => {
  const XLSX = 'https://france-resolution.fr/donnees/S%C3%A9ries%20des%20graphiques.xlsx';
  const XLSX2 = 'https://france-resolution.fr/donnees/Synth%C3%A8se%20des%20chiffrages.xlsx';

  it('ne casse pas l’encodage en pourcentage d’une adresse, même avec spaceBeforePercent', () => {
    for (const u of [XLSX, XLSX2]) {
      expect(typo(u, { spaceBeforePercent: true })).toBe(u);
      expect(typo(u, { spaceBeforePercent: true })).not.toMatch(/[\u00A0\u202F]/);
    }
  });

  it('protège une adresse noyée dans une phrase et ponctue le reste', () => {
    const t = typo(`Source : ${XLSX} ; 10% du total (voir ${XLSX2}).`, {
      spaceBeforePercent: true,
    });
    expect(t).toBe(`Source${NNBSP}: ${XLSX}${NNBSP}; 10${NBSP}% du total (voir ${XLSX2}).`);
  });

  it('typoDeep laisse intactes les clés url/href et toute chaîne qui est une adresse', () => {
    const data = {
      url: XLSX,
      pdf_url: XLSX2,
      origin_url: 'https://www.budget.gouv.fr/a%C3%A9',
      liens: [{ href: '/comprendre/niches/#a%C3%A9 10%', label: 'Un lien : 10%' }],
      source: { quote: 'Un fait : 10%', ref: XLSX },
    };
    const out = typoDeep(data, { spaceBeforePercent: true });
    expect(out.url).toBe(XLSX);
    expect(out.pdf_url).toBe(XLSX2);
    expect(out.origin_url).toBe(data.origin_url);
    expect(out.liens[0]!.href).toBe(data.liens[0]!.href);
    expect(out.liens[0]!.label).toBe(`Un lien${NNBSP}: 10${NBSP}%`);
    expect(out.source.quote).toBe(`Un fait${NNBSP}: 10${NBSP}%`);
    expect(out.source.ref).toBe(XLSX);
  });

  it('aucune chaîne de données ne contient d’espace insécable dans une adresse après la passe', async () => {
    const files = import.meta.glob('../data/*.json', { eager: true, import: 'default' });
    let urls = 0;
    const walk = (v: unknown) => {
      if (typeof v === 'string') {
        for (const m of v.matchAll(/https?:\/\/[^ \t\r\n"<>]+/g)) {
          urls++;
          expect(m[0], m[0]).not.toMatch(/[\u00A0\u202F]/);
        }
      } else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    for (const [path, json] of Object.entries(files)) {
      if (path.endsWith('manifest.json')) continue;
      walk(typoDeep(json, { spaceBeforePercent: true, enDash: true }));
    }
    expect(urls).toBeGreaterThan(1000); // url, pdf_url, docx_url, liasse_pdf_url… of every dataset
  });
});
