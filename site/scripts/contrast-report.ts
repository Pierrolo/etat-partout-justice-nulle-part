/**
 * Prints every guaranteed colour pair with its WCAG ratio, in both modes, on the tokens in force
 * (tokens.css with brand-ci.css on top). Exits 1 if any pair is below its minimum.
 *   pnpm --filter @epjn/site contrast
 */
import { readFileSync } from 'node:fs';
import { ALL_PAIRS, evaluate, parseTokens, resolveLook } from '../src/lib/contrast.ts';

const read = (name: string) =>
  readFileSync(new URL(`../src/styles/${name}`, import.meta.url), 'utf8');
const look = resolveLook(parseTokens(read('tokens.css')), parseTokens(read('brand-ci.css')));

const results = evaluate(look, ALL_PAIRS);
for (const mode of ['light', 'dark'] as const) {
  console.log(`\n== ${mode} ==`);
  for (const r of results.filter((x) => x.mode === mode)) {
    const flag = r.pass ? 'ok  ' : 'FAIL';
    console.log(
      `${flag} ${r.ratio.toFixed(2).padStart(5)} (min ${r.min})  ${r.fg} ${r.fgHex} on ${r.bg} ${r.bgHex}  — ${r.use}`,
    );
  }
}
const bad = results.filter((r) => !r.pass);
console.log(`\n${results.length - bad.length}/${results.length} pairs pass.`);
process.exit(bad.length ? 1 : 0);
