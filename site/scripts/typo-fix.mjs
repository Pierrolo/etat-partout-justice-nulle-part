#!/usr/bin/env node
/**
 * French typography codemod (audit M1, docs/qa/audit.md).
 *
 *   node scripts/typo-fix.mjs --check <files…>   list what would change, exit 1 if anything would
 *   node scripts/typo-fix.mjs --write <files…>   apply
 *
 * It rewrites ONLY copy found by `copy-spans.mjs` (JSX / Astro text, string literals, template chunks,
 * prose attributes) with `typo()` from src/lib/typo.ts: narrow no-break space before ; : ! ? and inside « »,
 * no-break space in « 12 % » « 10 € », narrow no-break space in « 10 000 », typographic apostrophes,
 * « 1er juillet ». Identifiers, imports, URLs, class names, CSS and <script> blocks are never touched.
 *
 * Safety nets, per file: (1) only spaces and apostrophes may change (the file is compared with every
 * space-like character folded to " " and every apostrophe folded to "'"); (2) the result is parsed again
 * and must have exactly as many spans; (3) idempotent. A file that fails any check is left untouched.
 *
 * Not for the simulator files (owned by another agent): the orchestrator runs it on them later:
 *   node scripts/typo-fix.mjs --write src/components/simulator/*.tsx src/lib/sim/*.ts src/pages/simulateur/*.astro
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { typo } from '../src/lib/typo.ts';
import { copySpans } from './copy-spans.ts';

const args = process.argv.slice(2);
const write = args.includes('--write');
const files = args.filter((a) => !a.startsWith('--'));
if (!files.length) {
  console.error('usage: typo-fix.mjs (--check|--write) <files…>');
  process.exit(2);
}

// Folding used by the safety net: every space-like character, entity and apostrophe becomes one plain one.
const fold = (s) =>
  s
    .replace(/&#8239;|&nbsp;|&#160;/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/’/g, "'");

/**
 * The Astro compiler (like Go's unicode.IsSpace) and JSX line trimming treat a no-break space at the EDGE of a
 * text node (next to `{expression}` or an element) as ordinary collapsible whitespace. At the edges, write the
 * entity instead: it survives compilation and renders as the intended character.
 */
const edgeEntities = (t) =>
  t
    .replace(/^[  ]/, (c) => (c === ' ' ? '&#8239;' : '&nbsp;'))
    .replace(/[  ]$/, (c) => (c === ' ' ? '&#8239;' : '&nbsp;'));

function fixRaw(raw, kind) {
  // `\'` inside a '-quoted string is an escaped apostrophe: make it typographic (valid in any quote).
  let t = raw.replace(/(\p{L})\\'(?=\p{L})/gu, '$1’');
  if (kind === 'jsxtext') {
    // In JSX / Astro text a line break is just a space: « mot\n  : » and « «\n mot » must not strand the mark.
    t = t.replace(/(?<=\S)[ \t]*\r?\n[ \t]*(?=[;:!?](?:[ \t\r\n»)]|$))/g, ' ');
    // « 80\n %»: a line break between a number and its unit is just a space too.
    t = t.replace(/(?<=\d)[ \t]*\r?\n[ \t]*(?=(?:Md€|M€|k€|€|%|‰)(?![\p{L}\d]))/gu, ' ');
    t = t.replace(/«[ \t]*\r?\n[ \t]*/g, '« ').replace(/[ \t]*\r?\n[ \t]*»/g, ' »');
    // An entity at the edge was already fixed: do not touch it.
    t = t.replace(/^&#8239;|^&nbsp;/, (e) => (e === '&nbsp;' ? ' ' : ' '));
    t = t.replace(/&#8239;$|&nbsp;$/, (e) => (e === '&nbsp;' ? ' ' : ' '));
  }
  // A chunk that starts with « :  » follows an expression: the word before the space is outside this span.
  if (kind !== 'string') t = t.replace(/^[ ]+(?=[;:!?](?:[   \n»)]|$))/, ' ');
  // Same for a unit: « {n} Md€ », « {n} % » — the number is in the expression before this chunk.
  if (kind !== 'string') t = t.replace(/^ +(?=(?:Md€|M€|k€|€|%|‰)(?![\p{L}\d]))/u, '\u00A0');
  t = typo(t);
  return kind === 'jsxtext' ? edgeEntities(t) : t;
}

let changedFiles = 0;
let failed = 0;
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const { spans, problems } = copySpans(src, file);
  if (problems.length) {
    console.error(`SKIP ${file}: ${problems.join('; ')}`);
    failed += 1;
    continue;
  }
  let out = '';
  let pos = 0;
  let n = 0;
  for (const s of spans) {
    if (s.start < pos) continue; // nested/overlapping: keep the first
    const fixed = fixRaw(s.raw, s.kind);
    out += src.slice(pos, s.start) + fixed;
    pos = s.end;
    if (fixed !== s.raw) n += 1;
  }
  out += src.slice(pos);
  if (out === src) continue;

  // Safety nets.
  if (fold(out) !== fold(src).replace(/\\'/g, "'")) {
    console.error(`REFUSED ${file}: the change touches more than spaces and apostrophes`);
    failed += 1;
    continue;
  }
  const again = copySpans(out, file);
  if (again.problems.length || again.spans.length !== spans.length) {
    console.error(`REFUSED ${file}: result does not parse like the original`);
    failed += 1;
    continue;
  }
  changedFiles += 1;
  console.log(`${write ? 'fixed' : 'would fix'} ${file} (${n} span${n > 1 ? 's' : ''})`);
  if (write) writeFileSync(file, out);
}
if (!write && changedFiles) process.exitCode = 1;
if (failed) process.exitCode = process.exitCode || 3;
