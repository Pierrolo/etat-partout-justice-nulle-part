/**
 * « Never type a figure in a page » (docs/VISION.md §2.2, lib/facts.ts): every public number comes from
 * facts.json or a dataset. This test scans the COPY (text nodes, string literals, template chunks and prose
 * attributes, found by scripts/copy-spans.ts: never identifiers, URLs or class names) of the pages, the story
 * and explorer components and the site chrome, and fails on a numeral that looks like a data point:
 * three digits or more, or a number with « € », « % », « M€ », « Md€ ».
 *
 * Years (1900–2100) are dates, not figures. Anything else that is legitimate must be listed in ALLOWED
 * with the reason: keep the list short. Simulator files are owned by another workstream and not scanned here.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { copySpans } from '../../scripts/copy-spans';

const SRC = join(import.meta.dirname, '..');

const ROOTS = [
  'pages',
  'components/story',
  'components/explorer',
  'components/site',
  'layouts',
  'lib/site.ts',
  'lib/situations.ts',
  'lib/etat-data.ts',
  'lib/story-data.ts',
  'lib/plan-data.ts',
  'lib/units.ts',
  'lib/amendements-model.ts',
  'lib/niches-model.ts',
  'lib/calendrier-model.ts',
];
/** Not scanned: the simulator (other owner), the design-system showcase, the 404 error code. */
const SKIP = [/pages\/simulateur\//, /pages\/styleguide\.astro$/, /\.test\.ts$/];

/** Hit text (as found) → reason. File restriction optional. */
const ALLOWED: Array<{ hit: RegExp; file?: RegExp; why: string }> = [
  {
    hit: /^(100|1)( €)?$|^100$/,
    file: /HundredSquares|pages\/(comprendre\/(index|depenses))/,
    why: 'unité du graphique « si l’argent public était 100 € »',
  },
  {
    hit: /^(0,5 M€|0 €)$/,
    file: /niches(-model\.ts|\.astro)$/,
    why: 'seuil de la classification de la source (« moins de 0,5 M€ ») et exemple de ce qu’on n’affiche pas',
  },
  {
    hit: /^163$/,
    file: /NichesExplorer/,
    why: 'numéro d’article du CGI cité en exemple de recherche',
  },
  {
    hit: /^(66,67 %|33,33 %|100 %)$/,
    file: /calendrier\.astro/,
    why: 'deux tiers et un tiers : définition arithmétique des paliers',
  },
  { hit: /^(< )?1 %$/, file: /UnitGrid/, why: 'règle d’affichage « moins de 1 % »' },
  { hit: /^404$/, file: /pages\/404\.astro/, why: 'code d’erreur HTTP' },
  { hit: /^320$/, file: /pages\/a-propos\.astro/, why: 'largeur de reflux WCAG, en pixels' },
];

const NUM =
  /(?<![\w.-])(?:\d[\d\s\u202F\u00A0]*\d|\d)(?:[,.]\d+)?(?:\s|\u00A0)?(?:Md€|M€|k€|€|%)|(?<![\w.,-])\d{3,}(?![\w-])/g;
const YEAR = /^(19|20)\d\d$/;

function files(): string[] {
  const out: string[] = [];
  const walk = (p: string) => {
    if (statSync(p).isDirectory()) for (const n of readdirSync(p)) walk(join(p, n));
    else if (/\.(astro|tsx|ts)$/.test(p)) out.push(p);
  };
  for (const r of ROOTS) walk(join(SRC, r));
  return out.filter((f) => !SKIP.some((re) => re.test(f.split('\\').join('/'))));
}

describe('facts discipline', () => {
  const found: string[] = [];
  const problems: string[] = [];
  for (const f of files()) {
    const rel = relative(SRC, f).split('\\').join('/');
    const { spans, problems: p } = copySpans(readFileSync(f, 'utf8'), f);
    if (p.length) problems.push(`${rel}: ${p.join('; ')}`);
    for (const s of spans) {
      // numeric entities (&#8239;) are typography, not figures
      const text = s.raw.replace(/&#\d+;/g, ' ');
      for (const m of text.matchAll(NUM)) {
        const hit = m[0].trim().replace(/[\u00A0\u202F]/g, ' ');
        if (YEAR.test(hit)) continue;
        if (ALLOWED.some((a) => a.hit.test(hit) && (!a.file || a.file.test(rel)))) continue;
        found.push(`${rel}: « ${hit} » dans « ${s.raw.replace(/\s+/g, ' ').slice(0, 80)} »`);
      }
    }
  }

  it('every scanned file parses (otherwise the scan would be blind)', () => {
    expect(problems).toEqual([]);
  });

  it('no hard-coded figure in pages, story, explorer and site copy', () => {
    expect(found).toEqual([]);
  });

  it('the scan sees the copy it is meant to guard (sanity check)', () => {
    const { spans } = copySpans('<p class="mt-2">Plus de 1 234 € par an.</p>', 'x.astro');
    expect(spans.map((s) => s.raw)).toEqual(['Plus de 1 234 € par an.']);
    const { spans: ts } = copySpans(
      "const a = 'Plus de 1 234 €'; import x from './1234.json';",
      'x.ts',
    );
    expect(ts.map((s) => s.raw)).toEqual(['Plus de 1 234 €']);
  });

  it('keeps the allow-list short', () => {
    expect(ALLOWED.length).toBeLessThanOrEqual(10);
  });
});
