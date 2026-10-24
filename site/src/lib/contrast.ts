/**
 * WCAG 2.x contrast helpers + the list of colour pairs the design system guarantees.
 * Parses `src/styles/tokens.css` (light-dark(#a, #b) declarations), so the CSS stays the single
 * source of truth. Used by contrast.test.ts, scripts/contrast-report.ts and the /styleguide page.
 *
 * Two token files share the same names: tokens.css is the base, brand-ci.css overrides it for the
 * look the site ships (`data-brand="ci"`). `resolveBrand()` merges the two parsed files, so every pair
 * below is checked for each brand; `BRAND_PAIRS` adds the pairs that only exist in one brand.
 */

import { BRANDS, type Brand } from './brands.ts';

export { BRANDS, type Brand };
export type Mode = 'light' | 'dark';
export type TokenMap = Record<Mode, Record<string, string>>;

/** Tokens of a brand = the base token file with the brand's overrides on top. */
export function resolveBrand(base: TokenMap, overrides?: TokenMap): TokenMap {
  if (!overrides) return base;
  return {
    light: { ...base.light, ...overrides.light },
    dark: { ...base.dark, ...overrides.dark },
  };
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Extract `--name: light-dark(#xxxxxx, #yyyyyy)` and plain `--name: #xxxxxx` declarations. */
export function parseTokens(css: string): TokenMap {
  const out: TokenMap = { light: {}, dark: {} };
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  for (const m of noComments.matchAll(re)) {
    const name = m[1]!;
    const value = m[2]!.trim();
    const ld = /^light-dark\(\s*(#[0-9a-f]{6})\s*,\s*(#[0-9a-f]{6})\s*\)$/i.exec(value);
    if (ld) {
      out.light[name] = ld[1]!.toLowerCase();
      out.dark[name] = ld[2]!.toLowerCase();
    } else if (HEX.test(value)) {
      out.light[name] = value.toLowerCase();
      out.dark[name] = value.toLowerCase();
    }
  }
  // Plain aliases (`--field-bg: var(--surface)`) take the value of their target, per mode.
  for (const m of noComments.matchAll(re)) {
    const alias = /^var\(\s*(--[a-z0-9-]+)\s*\)$/i.exec(m[2]!.trim());
    if (!alias) continue;
    for (const mode of ['light', 'dark'] as const) {
      const target = out[mode][alias[1]!];
      if (target && !out[mode][m[1]!]) out[mode][m[1]!] = target;
    }
  }
  return out;
}

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = channel(parseInt(h.slice(0, 2), 16));
  const g = channel(parseInt(h.slice(2, 4), 16));
  const b = channel(parseInt(h.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

export interface Pair {
  fg: string;
  bg: string;
  /** 4.5 = normal text, 3 = large text / UI components / graphical marks. */
  min: number;
  /** What the pair is used for. */
  use: string;
  /** Only evaluated in these modes (default: both). */
  modes?: readonly Mode[];
}

const text = (fg: string, bg: string, use: string): Pair => ({ fg, bg, min: 4.5, use });
const graphic = (fg: string, bg: string, use: string): Pair => ({ fg, bg, min: 3, use });

const surfaces = ['--paper', '--surface', '--sunken'] as const;

export const PAIRS: Pair[] = [
  // Body text on every surface
  ...surfaces.flatMap((s) => [
    text('--ink', s, 'Body text'),
    text('--ink-2', s, 'Secondary text'),
    text('--ink-3', s, 'Muted text'),
    text('--accent', s, 'Links, accent text'),
    text('--gain', s, 'Gain text'),
    text('--loss', s, 'Loss text'),
  ]),
  text('--accent', '--accent-soft', 'Accent text on soft accent wash'),
  text('--ink', '--accent-soft', 'Body text on soft accent wash'),
  text('--gain', '--gain-soft', 'Gain text on soft wash'),
  text('--loss', '--loss-soft', 'Loss text on soft wash'),
  text('--ink', '--gain-soft', 'Body text on gain wash'),
  text('--ink', '--loss-soft', 'Body text on loss wash'),
  text('--on-accent', '--accent', 'Label on solid accent (buttons)'),
  text('--on-gain', '--gain', 'Label on solid gain'),
  text('--on-loss', '--loss', 'Label on solid loss'),
  text('--tier-law-fg', '--tier-law-bg', 'Tier badge « Écrit dans la loi »'),
  text('--ink-2', '--surface', 'Tier badge « Annoncé » label'),
  // Non-text contrast (WCAG 1.4.11)
  graphic('--rule-strong', '--paper', 'Control borders on paper'),
  graphic('--rule-strong', '--surface', 'Control borders on cards'),
  graphic('--accent', '--paper', 'Focus ring on paper'),
  graphic('--accent', '--surface', 'Focus ring on cards'),
  graphic('--tier-announced-bd', '--surface', 'Announced badge dashed border'),
  graphic('--tier-hypothesis-bd', '--surface', 'Hypothesis badge dotted border'),
  // Chart marks vs the plates they sit on
  ...[1, 2, 3, 4, 5, 6, 7, 8].flatMap((n) => [
    graphic(`--series-${n}`, '--paper', `Categorical series ${n} on paper`),
    graphic(`--series-${n}`, '--surface', `Categorical series ${n} on card`),
  ]),
  // Text printed ON a chart fill
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
    text(`--on-series-${n}`, `--series-${n}`, `Label on categorical series ${n}`),
  ),
  text('--on-hour-keep', '--series-1', 'Label on the « Vous gardez » segment'),
  graphic('--gain-mark', '--paper', 'Diverging gain pole (mark) on paper'),
  graphic('--loss-mark', '--paper', 'Diverging loss pole (mark) on paper'),
  graphic('--gain-mark', '--surface', 'Diverging gain pole (mark) on card'),
  graphic('--loss-mark', '--surface', 'Diverging loss pole (mark) on card'),
  // Form fields
  text('--ink', '--field-bg', 'Typed text in a field'),
  text('--ink-3', '--field-bg', 'Placeholder / hint in a field'),
  graphic('--rule-strong', '--field-bg', 'Field border on its own fill'),
  graphic('--div-gain-3', '--surface', 'Diverging gain, 3rd step'),
  graphic('--div-loss-3', '--surface', 'Diverging loss, 3rd step'),
  graphic('--seq-5', '--surface', 'Sequential, 5th step'),
];

/**
 * Pairs that exist on the shipped look only. It has a second accent, `signal`, with its
 * own rules (README of the brand): text on it is always `ink`; as TEXT it is only allowed on the dark
 * scene (2,8 : 1 on paper: fills and strokes only), so that pair is checked in dark mode only.
 */
export const BRAND_PAIRS: Record<Brand, Pair[]> = {
  editorial: [],
  ci: [
    text('--on-signal', '--signal', 'Label on the signal fill (primary button, key figure)'),
    text('--on-signal', '--btn-primary-hover', 'Label on the hovered primary button'),
    ...surfaces.map((s) => ({
      ...text('--signal', s, 'Key figure in signal, on the dark scene'),
      modes: ['dark'] as const,
    })),
    { ...graphic('--signal', '--surface', 'Signal pulse on the dark scene'), modes: ['dark'] },
    graphic('--line', '--paper', 'Brand rule (1,5 px line) on the page'),
    graphic('--line', '--surface', 'Brand rule (1,5 px line) on a card'),
  ],
};

/** Every pair that must hold for a brand. */
export const pairsFor = (brand: Brand): Pair[] => [...PAIRS, ...BRAND_PAIRS[brand]];

export interface PairResult extends Pair {
  mode: Mode;
  fgHex: string;
  bgHex: string;
  ratio: number;
  pass: boolean;
}

export function evaluate(tokens: TokenMap, pairs: Pair[] = PAIRS): PairResult[] {
  const results: PairResult[] = [];
  for (const mode of ['light', 'dark'] as const) {
    for (const p of pairs) {
      if (p.modes && !p.modes.includes(mode)) continue;
      const fgHex = tokens[mode][p.fg];
      const bgHex = tokens[mode][p.bg];
      if (!fgHex || !bgHex) throw new Error(`Unknown token in pair ${p.fg} / ${p.bg} (${mode})`);
      const ratio = contrastRatio(fgHex, bgHex);
      results.push({ ...p, mode, fgHex, bgHex, ratio, pass: ratio >= p.min });
    }
  }
  return results;
}
