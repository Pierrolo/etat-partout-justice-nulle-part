/**
 * CHART THEME — colours, Observable Plot defaults and French tick formatters.
 *
 * Method: `dataviz` skill (form → colour job → validate → marks → hover → accessibility).
 * Palette values mirror the tokens in force (tokens.css under brand-ci.css; chart-theme.test.ts keeps
 * both in sync) and were validated with the skill's validator — numbers below and in brand-ci.css.
 *
 * Colour jobs (never mix them):
 *   categorical  identity of a series            → `categorical` / `series(n)`     fixed order, ≤ 8, never cycled
 *   sequential   magnitude                       → `sequential`                     one hue, light → dark
 *   diverging    polarity (gain | loss)          → `diverging`, `polarity`          teal-blue ↔ vermilion, grey midpoint
 *   emphasis     "le plan" vs the rest           → `accent` + neutral `ink3`        plan = accent, baseline = grey
 *
 * In SVG that lives in the page, prefer the `css.*` strings (`var(--series-1)`): they follow the
 * theme toggle with no re-render. Use the hex palettes (`palette(mode)`) only for continuous
 * interpolation (heatmaps) and for canvas/PNG export, and re-render when the mode changes.
 */
import { interpolateRgb, piecewise } from 'd3';
import type * as PlotNS from '@observablehq/plot';
import {
  formatCompactEuro,
  formatEuro,
  formatEuroDelta,
  formatNumber,
  formatPercent,
} from './format';

export type ColorMode = 'light' | 'dark';

/* ── Palettes (hex) ─────────────────────────────────────────────────────── */
/*
 * The shipped look (styles/brand-ci.css) — chart-theme.test.ts keeps every value below in sync with it.
 * Validation (dataviz skill, scripts/validate_palette.js; plates = the darkest surface of each mode):
 *   categorical light  adjacent CVD ΔE 14.4 (target 8), normal-vision 25.1 (floor 15), all ≥ 3 : 1 on #e4e0d3
 *   categorical dark   adjacent CVD ΔE 13.3,             normal-vision 22.8,            all ≥ 3 : 1 on #262c29
 *   first three slots also pass `--pairs all` in both modes; any two of the 8: normal-vision ΔE ≥ 13.3 / 11.2.
 *   polarity  teal vs signal-orange: lightness differs (OKLCH L .44 / .60 light, .78 / .66 dark), CVD ΔE ≥ 11.
 */

export const categorical = {
  light: ['#0b8e7f', '#d9480f', '#3c52b6', '#43600e', '#963c91', '#8c7e2d', '#816bd8', '#96173a'],
  dark: ['#0b9989', '#f25820', '#5e73b8', '#73a21f', '#ba5db3', '#8a7b1d', '#9581ef', '#c64961'],
} as const;
/** Names of the 8 hues, in slot order. */
export const categoricalNames = [
  'sarcelle',
  'orange signal',
  'indigo',
  'sapin',
  'prune',
  'kaki',
  'violet',
  'bordeaux',
] as const;
export const otherColor = { light: '#747b77', dark: '#7d857f' } as const;

export const sequential = {
  light: ['#d6e4de', '#b0cfc5', '#82b3a6', '#559787', '#2f7a6b', '#0f5e55', '#093d37'],
  dark: ['#1c3a35', '#24524a', '#2c6c61', '#36887a', '#46a898', '#6ec6b6', '#9ddfd2'],
} as const;

/** Gain arm (strong → light), neutral midpoint, loss arm (light → strong). 9 stops, symmetric. */
export const diverging = {
  light: {
    gain: ['#0f5e55', '#3a8377', '#8fbbb0', '#cde0d9'],
    mid: '#ece9df',
    loss: ['#f3d3c1', '#eba283', '#dc501a', '#c43c06'],
  },
  dark: {
    gain: ['#4ad0ba', '#35a392', '#27766b', '#1e4a43'],
    mid: '#2c3330',
    loss: ['#4e2e22', '#8d3f1e', '#d9551d', '#ff5a1f'],
  },
} as const;

/** Poles of the diverging pair, for bars/lines (≥ 3 : 1 on paper and card): the `-mark` tokens. */
export const polarity = {
  gain: { light: '#0f5e55', dark: '#4ad0ba' },
  loss: { light: '#d9480f', dark: '#f25820' },
} as const;

export const accent = { light: '#121614', dark: '#f3f1ea' } as const;

export const chrome = {
  grid: { light: '#d2cdbd', dark: '#353d39' },
  axis: { light: '#121614', dark: '#a3aaa5' },
  ink: { light: '#121614', dark: '#f3f1ea' },
  ink2: { light: '#323935', dark: '#d3d5ce' },
  ink3: { light: '#5c635f', dark: '#a3aaa5' },
  surface: { light: '#e4e0d3', dark: '#262c29' },
  paper: { light: '#f3f1ea', dark: '#121614' },
} as const;

export function palette(mode: ColorMode) {
  return {
    categorical: categorical[mode],
    sequential: sequential[mode],
    diverging: [...diverging[mode].gain, diverging[mode].mid, ...diverging[mode].loss] as string[],
    gain: polarity.gain[mode],
    loss: polarity.loss[mode],
    accent: accent[mode],
    other: otherColor[mode],
  };
}

/* ── CSS-variable references (follow the theme automatically) ───────────── */

const seriesVars = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `var(--series-${n})`);

export const css = {
  series: seriesVars,
  other: 'var(--series-other)',
  /** Poles as MARKS (bars, lines, dots). For gain / loss as TEXT use the `text-gain` / `text-loss` classes. */
  gain: 'var(--gain-mark)',
  loss: 'var(--loss-mark)',
  accent: 'var(--accent)',
  ink: 'var(--ink)',
  ink2: 'var(--ink-2)',
  ink3: 'var(--ink-3)',
  grid: 'var(--chart-grid)',
  axis: 'var(--chart-axis)',
  surface: 'var(--surface)',
  paper: 'var(--paper)',
  sequential: [1, 2, 3, 4, 5, 6, 7].map((n) => `var(--seq-${n})`),
  /** 9 stops, gain (strong) → mid → loss (strong), ordered so that NEGATIVE (loss) is on the low end. */
  diverging: [
    'var(--div-loss-4)',
    'var(--div-loss-3)',
    'var(--div-loss-2)',
    'var(--div-loss-1)',
    'var(--div-mid)',
    'var(--div-gain-1)',
    'var(--div-gain-2)',
    'var(--div-gain-3)',
    'var(--div-gain-4)',
  ],
};

/**
 * Colour of the n-th series (0-based). Colour follows the ENTITY, never its rank: keep a stable
 * `Record<entityId, index>` in the data layer and never re-index after filtering.
 * Index ≥ 8 returns the neutral « Autres » colour — fold the tail instead of cycling hues.
 */
export function series(index: number): string {
  return index >= 0 && index < seriesVars.length ? seriesVars[index]! : css.other;
}

/* ── Continuous interpolators (hex → need the colour mode) ──────────────── */

/** 0 → 1 over the sequential ramp. */
export function sequentialInterpolator(mode: ColorMode): (t: number) => string {
  return piecewise(interpolateRgb, [...sequential[mode]]);
}

/**
 * Diverging interpolator on [−1, 1]: −1 = strongest loss, 0 = neutral, +1 = strongest gain.
 * Use with a symmetric domain (`[-m, m]`) so equal magnitudes get equal intensity.
 */
export function divergingInterpolator(mode: ColorMode): (t: number) => string {
  const d = diverging[mode];
  const stops = [...[...d.loss].reverse(), d.mid, ...[...d.gain].reverse()];
  const interp = piecewise(interpolateRgb, stops);
  return (v) => interp((Math.max(-1, Math.min(1, v)) + 1) / 2);
}

/* ── French tick / label formatters (deterministic; see format.ts) ──────── */

export const fr = {
  number: (d: number) => formatNumber(d, { decimals: { min: 0, max: 2 } }),
  integer: (d: number) => formatNumber(d),
  euro: (d: number) => formatEuro(d),
  euroDelta: (d: number) => formatEuroDelta(d),
  /** Axis ticks in €/month etc. Short: « 1 200 € ». */
  euroTick: (d: number) => formatEuro(d),
  /** « 1 672 Md€ » from a value in euros. */
  compactEuro: (d: number) => formatCompactEuro(d),
  /** Ratio → « 57 % ». */
  percent: (d: number) => formatPercent(d),
  percentSigned: (d: number) => formatPercent(d, { signed: true }),
  month: (d: Date) =>
    new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
      d,
    ),
  year: (d: Date | number) => String(d instanceof Date ? d.getUTCFullYear() : d),
} as const;

/* ── Observable Plot defaults ───────────────────────────────────────────── */

export interface PlotDefaultsOptions {
  /** Left margin override (labels of horizontal bars need more room). */
  marginLeft?: number;
  /** Include a y-grid (default true). */
  grid?: boolean;
}

/**
 * Base options for `Plot.plot()`; spread first, then your own:
 *   Plot.plot({ ...plotDefaults(), width, marks: [...] })
 *
 * Marks follow the dataviz mark specs: thin (≤ 24 px bars, 2 px lines), hairline recessive grid,
 * ink-3 axis text (text never wears a series colour), colour from CSS variables.
 */
export function plotDefaults(opts: PlotDefaultsOptions = {}): PlotNS.PlotOptions {
  const { marginLeft = 48, grid = true } = opts;
  return {
    style: {
      background: 'transparent',
      color: 'var(--ink-2)',
      fontFamily: 'var(--ff-sans)',
      fontSize: '12px',
      overflow: 'visible',
    },
    marginTop: 16,
    marginRight: 16,
    marginBottom: 36,
    marginLeft,
    color: { range: [...css.series] },
    x: { labelAnchor: 'right', tickSize: 0, tickPadding: 8 },
    y: { grid, labelAnchor: 'top', tickSize: 0, tickPadding: 8 },
  } as PlotNS.PlotOptions;
}

/** CSS injected next to each plot so axis lines/grid read as hairlines (Plot has no option for it). */
export const plotCss = `
  .epjn-plot [aria-label$="grid"] line, .epjn-plot [aria-label$="grid"] path { stroke: var(--chart-grid); stroke-width: 1; stroke-opacity: 1; }
  .epjn-plot [aria-label$="axis"] line, .epjn-plot [aria-label$="axis"] path { stroke: var(--chart-axis); }
  .epjn-plot [aria-label$="tick label"] text, .epjn-plot [aria-label$="label"] text { fill: var(--ink-3); }
`;

/* ── Hatched fill for « annoncé, sans texte de loi » ────────────────────── */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Adds (once) a 45° hatch <pattern> to an SVG and returns the `url(#id)` to use as a `fill`.
 * Tone-on-tone: a 14 % wash of `color` with 1.5 px diagonal strokes of `color` — so the same series
 * hue stays readable and « annoncé » is never signalled by colour alone. `--hatch-stroke` recolours
 * the strokes over the same wash; the variable is read by the browser, so a look change needs no re-render.
 * Call after `Plot.plot()` returned the element (patterns resolve lazily), e.g.
 *   const hatch = hatchFill(svg, 'announced-1', css.series[0]!);
 */
export function hatchFill(svg: SVGSVGElement | HTMLElement, id: string, color: string): string {
  const root = svg instanceof SVGSVGElement ? svg : svg.querySelector('svg');
  if (!root) throw new Error('hatchFill: no <svg> found');
  const patternId = `epjn-hatch-${id}`;
  if (!root.querySelector(`#${patternId}`)) {
    let defs = root.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS(SVG_NS, 'defs');
      root.prepend(defs);
    }
    const p = document.createElementNS(SVG_NS, 'pattern');
    p.setAttribute('id', patternId);
    p.setAttribute('width', '7');
    p.setAttribute('height', '7');
    p.setAttribute('patternUnits', 'userSpaceOnUse');
    p.setAttribute('patternTransform', 'rotate(45)');
    const wash = document.createElementNS(SVG_NS, 'rect');
    wash.setAttribute('width', '7');
    wash.setAttribute('height', '7');
    wash.setAttribute('fill', color);
    wash.setAttribute('fill-opacity', '0.14');
    const line = document.createElementNS(SVG_NS, 'rect');
    line.setAttribute('width', '1.5');
    line.setAttribute('height', '7');
    line.setAttribute('fill', `var(--hatch-stroke, ${color})`);
    p.append(wash, line);
    defs.append(p);
  }
  return `url(#${patternId})`;
}

/* ── Runtime helpers (browser only) ─────────────────────────────────────── */

/** Current colour mode: explicit `data-theme`, else the OS preference. */
export function currentColorMode(): ColorMode {
  if (typeof document === 'undefined') return 'light';
  const t = document.documentElement.dataset.theme;
  if (t === 'light' || t === 'dark') return t;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Resolve a CSS colour expression (`var(--series-1)`, `var(--ink)`) to `rgb(…)` — needed for
 * canvas / PNG export, where `var()` does not exist. (Custom properties holding `light-dark()` are
 * not resolved by getComputedStyle, so we resolve through a real `color` property.)
 */
export function resolveColor(
  expression: string,
  scope: Element = document.documentElement,
): string {
  const probe = document.createElement('span');
  probe.style.color = expression;
  probe.style.display = 'none';
  scope.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}
