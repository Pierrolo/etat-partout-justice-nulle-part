/**
 * Prints every guaranteed colour pair with its WCAG ratio, in both modes, for each brand.
 *   pnpm --filter @epjn/site contrast               # both brands
 *   pnpm --filter @epjn/site contrast -- ci         # one brand: editorial | ci
 * Exits 1 if any pair is below its minimum.
 */
import { readFileSync } from 'node:fs';
import {
  BRANDS,
  evaluate,
  pairsFor,
  parseTokens,
  resolveBrand,
  type Brand,
} from '../src/lib/contrast.ts';

const read = (name: string) =>
  readFileSync(new URL(`../src/styles/${name}`, import.meta.url), 'utf8');
const base = parseTokens(read('tokens.css'));
const overrides: Record<Brand, ReturnType<typeof parseTokens> | undefined> = {
  editorial: undefined,
  ci: parseTokens(read('brand-ci.css')),
};

const asked = process.argv
  .slice(2)
  .filter((a): a is Brand => (BRANDS as readonly string[]).includes(a));
const brands = asked.length ? asked : BRANDS;
let failing = 0;

for (const brand of brands) {
  const results = evaluate(resolveBrand(base, overrides[brand]), pairsFor(brand));
  console.log(`\n######## brand: ${brand} ########`);
  for (const mode of ['light', 'dark'] as const) {
    console.log(`\n== ${brand} / ${mode} ==`);
    for (const r of results.filter((x) => x.mode === mode)) {
      const flag = r.pass ? 'ok  ' : 'FAIL';
      console.log(
        `${flag} ${r.ratio.toFixed(2).padStart(5)} (min ${r.min})  ${r.fg} ${r.fgHex} on ${r.bg} ${r.bgHex}  — ${r.use}`,
      );
    }
  }
  const bad = results.filter((r) => !r.pass);
  failing += bad.length;
  console.log(`\n${brand}: ${results.length - bad.length}/${results.length} pairs pass.`);
}
process.exit(failing ? 1 : 0);
