/**
 * Recherche en français : insensible à la casse, aux accents, aux ligatures et aux apostrophes
 * typographiques. Partagée par les explorateurs de niches et d'amendements.
 */

/** « Crédit d’impôt ŒUVRE » → « credit d'impot oeuvre ». */
export function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\u00A0\u202F]/g, ' ')
    .replace(/[’‘`´]/g, "'")
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .toLowerCase();
}

/** Mots de la requête, normalisés ; tous doivent se trouver dans le texte indexé (ET). */
export function tokens(query: string): string[] {
  return normalize(query).split(/\s+/).filter(Boolean);
}

export function matchesAll(haystack: string, toks: readonly string[]): boolean {
  for (const t of toks) if (!haystack.includes(t)) return false;
  return true;
}
