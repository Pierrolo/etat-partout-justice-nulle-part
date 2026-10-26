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
