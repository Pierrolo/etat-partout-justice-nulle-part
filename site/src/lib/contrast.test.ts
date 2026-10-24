import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BRANDS,
  contrastRatio,
  evaluate,
  pairsFor,
  parseTokens,
  resolveBrand,
  type Brand,
} from './contrast';

const read = (name: string) => readFileSync(new URL(`../styles/${name}`, import.meta.url), 'utf8');
const css = read('tokens.css');
const tokens = parseTokens(css);
const ci = parseTokens(read('brand-ci.css'));
const byBrand: Record<Brand, ReturnType<typeof resolveBrand>> = {
  editorial: tokens,
  ci: resolveBrand(tokens, ci),
};

describe('contrast maths', () => {
  it('matches known WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
});

describe('design tokens', () => {
  it('parses both modes', () => {
    expect(tokens.light['--paper']).toBe('#faf8f4');
    expect(tokens.dark['--paper']).toBe('#14151a');
  });
  it('resolves plain aliases (--field-bg: var(--surface))', () => {
    expect(tokens.light['--field-bg']).toBe(tokens.light['--surface']);
    expect(tokens.dark['--field-bg']).toBe(tokens.dark['--surface']);
  });
});

describe.each(BRANDS)('brand « %s »: WCAG 2.2 AA', (brand) => {
  const map = byBrand[brand];
  const results = evaluate(map, pairsFor(brand));

  it('has no failing pair, in light and in dark', () => {
    const failing = results
      .filter((r) => !r.pass)
      .map(
        (r) =>
          `${r.mode}: ${r.fg} ${r.fgHex} on ${r.bg} ${r.bgHex} = ${r.ratio.toFixed(2)} < ${r.min} (${r.use})`,
      );
    expect(failing).toEqual([]);
  });

  it('checks both modes', () => {
    expect(results.some((r) => r.mode === 'light')).toBe(true);
    expect(results.some((r) => r.mode === 'dark')).toBe(true);
  });
});

describe('brand « ci » follows the brand README', () => {
  const l = byBrand.ci.light;
  const d = byBrand.ci.dark;
  it('uses the owner’s palette literally', () => {
    expect(l['--paper']).toBe('#f3f1ea');
    expect(l['--surface']).toBe('#e4e0d3'); // paper-deep
    expect(l['--ink']).toBe('#121614');
    expect(d['--paper']).toBe('#121614'); // dark ground = ink
    expect(d['--surface']).toBe('#262c29'); // dark surface = ink-soft
    expect(d['--ink']).toBe('#f3f1ea'); // dark text = paper
    expect(d['--ink-3']).toBe('#a3aaa5'); // muted-dark
    expect(l['--ink-3']).toBe('#5c635f'); // muted
    expect(l['--signal']).toBe('#ff5a1f');
    expect(l['--gain']).toBe('#0f5e55'); // teal
  });
  it('never sets text in signal on paper (README: 2,8 : 1, fills and strokes only)', () => {
    expect(contrastRatio(l['--signal']!, l['--paper']!)).toBeLessThan(3);
    // …so the light-mode text tokens are not signal, and text ON signal is ink
    for (const t of ['--ink', '--ink-2', '--ink-3', '--accent', '--link', '--gain', '--loss'])
      if (l[t]) expect(l[t]).not.toBe(l['--signal']);
    expect(l['--on-signal']).toBe(l['--ink']);
  });
  it('keeps gain and loss apart by lightness, not only by hue', () => {
    const lum = (hex: string) => contrastRatio(hex, '#000000');
    for (const m of [l, d]) {
      const ratio = lum(m['--gain-mark']!) / lum(m['--loss-mark']!);
      expect(Math.max(ratio, 1 / ratio)).toBeGreaterThan(1.3);
    }
  });
});
