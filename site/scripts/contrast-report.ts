/**
 * Prints every guaranteed colour pair with its WCAG ratio, in both modes.
 *   pnpm --filter @epjn/site contrast
 * Exits 1 if any pair is below its minimum.
 */
import { readFileSync } from 'node:fs';
import { evaluate, parseTokens } from '../src/lib/contrast.ts';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const results = evaluate(parseTokens(css));

for (const mode of ['light', 'dark'] as const) {
  console.log(`\n== ${mode} ==`);
  for (const r of results.filter((x) => x.mode === mode)) {
    const flag = r.pass ? 'ok  ' : 'FAIL';
    console.log(
      `${flag} ${r.ratio.toFixed(2).padStart(5)} (min ${r.min})  ${r.fg} ${r.fgHex} on ${r.bg} ${r.bgHex}  — ${r.use}`,
    );
  }
}
const failing = results.filter((r) => !r.pass);
console.log(`\n${results.length - failing.length}/${results.length} pairs pass.`);
process.exit(failing.length ? 1 : 0);
