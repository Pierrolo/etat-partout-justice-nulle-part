/**
 * WCAG 2.x contrast helpers + the list of colour pairs the design system guarantees.
 * Parses `src/styles/tokens.css` (light-dark(#a, #b) declarations), so the CSS stays the single
 * source of truth. Used by contrast.test.ts, scripts/contrast-report.ts and the /styleguide page.
 */

export type Mode = 'light' | 'dark';
export type TokenMap = Record<Mode, Record<string, string>>;

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
  graphic('--gain', '--paper', 'Diverging gain pole'),
  graphic('--loss', '--paper', 'Diverging loss pole'),
  graphic('--div-gain-3', '--surface', 'Diverging gain, 3rd step'),
  graphic('--div-loss-3', '--surface', 'Diverging loss, 3rd step'),
  graphic('--seq-5', '--surface', 'Sequential, 5th step'),
];

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
      const fgHex = tokens[mode][p.fg];
      const bgHex = tokens[mode][p.bg];
      if (!fgHex || !bgHex) throw new Error(`Unknown token in pair ${p.fg} / ${p.bg} (${mode})`);
      const ratio = contrastRatio(fgHex, bgHex);
      results.push({ ...p, mode, fgHex, bgHex, ratio, pass: ratio >= p.min });
    }
  }
  return results;
}
