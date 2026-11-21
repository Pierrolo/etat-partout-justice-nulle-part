/**
 * French typography for running text (Imprimerie nationale conventions, as asked by the audit M1).
 *
 *   « mot ? »   narrow no-break space (U+202F) before ; : ! ? and inside « »
 *   12 %  12 €  no-break space (U+00A0) between a number and its unit
 *   10 000      narrow no-break space (U+202F) between groups of three digits (like `format.ts`)
 *   l’État      typographic apostrophe between two letters
 *   1er juillet « 1 juillet » → « 1er juillet »
 *
 * Pure and idempotent: `typo(typo(s)) === typo(s)`. It only ever rewrites spaces and apostrophes,
 * never letters or digits, so it is safe on any French prose — but NOT on code, URLs or class names:
 * call it on copy only. The codemod `site/scripts/typo-fix.mjs` applies it to the text nodes and
 * string literals of authored files; `astro.config.mjs` applies it to the JSON datasets at build time.
 */

/** Narrow no-break space (U+202F). */
export const NNBSP = ' ';
/** No-break space (U+00A0). */
export const NBSP = ' ';

export interface TypoOptions {
  /** « 10% » → « 10 % ». Off for code-ish strings (CSS widths…); on for datasets. */
  spaceBeforePercent?: boolean;
  /** « ADEME - Agence » → « ADEME – Agence ». Datasets only. */
  enDash?: boolean;
  /**
   * The text starts right after an inline element or expression (« <strong>Note</strong> : … »): the word
   * before a leading « ; : ! ? » is outside `input`, so a leading space is still a space before the mark.
   */
  afterInline?: boolean;
}

const MONTHS =
  'janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre';

/** What may follow a punctuation mark that closes a word. */
const AFTER_PUNCT = '(?:$|[\\s\\u00A0\\u202F»)\\]”’"\'.,—–<])';

const RE_BEFORE_PUNCT = new RegExp(
  `(?<=[^\\s\\u00A0\\u202F])[ \\u00A0]+(?=[;:!?]${AFTER_PUNCT})`,
  'g',
);
const RE_GROUPS = /(?<![\d,.])\d{1,3}(?:[  ]\d{3})+(?!\d)/g;
const RE_UNIT = /(\d) +(?=(?:Md€|M€|k€|€|%|‰)(?![\p{L}\d]))/gu;
const RE_FIRST = new RegExp(`(?<![\\d,.h])\\b1(?=[ \\u00A0\\u202F](?:${MONTHS})\\b)`, 'gu');

/**
 * Web addresses are never prose: « …/S%C3%A9ries.xlsx » must not become « …/S%C3 %A9ries.xlsx » (the « 3% » rule
 * of `spaceBeforePercent`), nor an address followed by « : » get a no-break space glued into it. They are swapped
 * for opaque placeholders for the duration of the pass, then put back untouched (R2-01).
 */
const RE_URL = /(?:https?:\/\/|mailto:)[^\s<>"'«»]+/g;
/** Characters of a URL that are really the sentence's punctuation when they end it. */
const URL_TAIL = /[.,;:!?)\]”’]+$/;

export function typo(input: string, opts: TypoOptions = {}): string {
  if (!input) return input;
  if (/https?:\/\/|mailto:/.test(input)) {
    const urls: string[] = [];
    const masked = input.replace(RE_URL, (u) => {
      const tail = URL_TAIL.exec(u)?.[0] ?? '';
      const core = tail ? u.slice(0, -tail.length) : u;
      urls.push(core);
      return `\uE000${urls.length - 1}\uE001${tail}`;
    });
    // Placeholders contain no letter, digit or space: no rule can rewrite them.
    const out = typo(masked, opts);
    return out.replace(/\uE000(\d+)\uE001/g, (_m, i: string) => urls[Number(i)]!);
  }
  // A letter stands for the word that precedes the text (it is never rewritten, and is dropped at the end).
  const lead = opts.afterInline ? 'x' : '';
  let s = lead + input;

  // Typographic apostrophe between two letters (l'État → l’État).
  s = s.replace(/(\p{L})'(?=\p{L})/gu, '$1’');

  // Guillemets: « mot » with narrow no-break spaces inside.
  s = s.replace(/«[   ]+/g, `«${NNBSP}`).replace(/[   ]+»/g, `${NNBSP}»`);

  // Before ; : ! ? — only when the mark ends a word (so « a ?b », « :hover » stay untouched).
  s = s.replace(RE_BEFORE_PUNCT, NNBSP);

  // Groups of three digits: 10 000 (not after a decimal comma, not inside a longer number).
  s = s.replace(RE_GROUPS, (m) => m.replace(/[  ]/g, NNBSP));

  // Number + unit: 80 %, 143 Md€.
  s = s.replace(RE_UNIT, `$1${NBSP}`);
  if (opts.spaceBeforePercent) s = s.replace(/(\d)%/g, `$1${NBSP}%`);

  // « 1 juillet » → « 1er juillet ».
  s = s.replace(RE_FIRST, '1er');

  if (opts.enDash) s = s.replace(/(?<=\S) - (?=\S)/g, ' – ');
  return lead ? s.slice(lead.length) : s;
}

/** Keys whose value is a web address (never typographed): `url`, `href`, `pdf_url`, `origin_url`… */
const URL_KEY = /(?:^|_)(?:url|href)$/i;
/** A string that is nothing but a web address. */
const WHOLE_URL = /^(?:https?:\/\/|mailto:)\S+$/;

/** Deep-map every string of a JSON-like value through `typo` (datasets, build time). URLs are left as they are. */
export function typoDeep<T>(value: T, opts: TypoOptions = {}, key?: string): T {
  if (typeof value === 'string') {
    if ((key && URL_KEY.test(key)) || WHOLE_URL.test(value)) return value;
    return typo(value, opts) as T;
  }
  if (Array.isArray(value)) return value.map((v) => typoDeep(v, opts, key)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = typoDeep(v, opts, k);
    }
    return out as T;
  }
  return value;
}
