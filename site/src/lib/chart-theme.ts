/**
 * CHART THEME — colours, Observable Plot defaults and French tick formatters.
 *
 * Method: `dataviz` skill (form → colour job → validate → marks → hover → accessibility).
 * Palette values mirror src/styles/tokens.css (chart-theme.test.ts keeps both in sync) and were
 * validated with the skill's validator — see the header of tokens.css for the numbers.
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

export const categorical = {
  light: ['#2d6bbb', '#df662f', '#00918b', '#bb8603', '#d66098', '#6f8f20', '#7255cf', '#a0522c'],
  dark: ['#4f8ddf', '#de6a35', '#00aaa3', '#b88715', '#d6679a', '#80a236', '#8a6ee2', '#b66946'],
} as const;
/** Names of the 8 hues, in slot order. */
export const categoricalNames = [
  'bleu',
  'orange',
  'sarcelle',
  'ocre',
  'rose',
  'olive',
  'violet',
  'terre',
] as const;
export const otherColor = { light: '#8a867b', dark: '#6b6d78' } as const;

export const sequential = {
  light: ['#e4f0ff', '#b4d1f7', '#87b2eb', '#5c92db', '#3473c4', '#0a55a8', '#003889'],
  dark: ['#202f42', '#29456a', '#325c94', '#3e75bd', '#4f8fe3', '#66aaff', '#81c6ff'],
} as const;

/** Gain arm (strong → light), neutral midpoint, loss arm (light → strong). 9 stops, symmetric. */
export const diverging = {
  light: {
    gain: ['#00737a', '#33a0aa', '#85c4cc', '#c3e0e5'],
    mid: '#ebe8e0',
    loss: ['#f3cdbb', '#e9a07f', '#d36d43', '#bc3f06'],
  },
  dark: {
    gain: ['#58d0d6', '#35a3a9', '#2a7a7f', '#1f4a4d'],
    mid: '#2c2e37',
    loss: ['#5a3426', '#92522f', '#c9703f', '#f2956a'],
  },
} as const;

/** Poles of the diverging pair, for bars/lines (≥ 3 : 1 on paper and card). */
export const polarity = {
  gain: { light: '#00737a', dark: '#28bac1' },
  loss: { light: '#bc3f06', dark: '#ef8959' },
} as const;

export const accent = { light: '#602e9d', dark: '#d4bcff' } as const;

export const chrome = {
  grid: { light: '#e4e0d6', dark: '#2c2d35' },
  axis: { light: '#b9b5a9', dark: '#4a4c57' },
  ink: { light: '#15171c', dark: '#edece7' },
  ink2: { light: '#434852', dark: '#c4c3bc' },
  ink3: { light: '#5c616c', dark: '#9a9ca6' },
  surface: { light: '#ffffff', dark: '#1c1d24' },
  paper: { light: '#faf8f4', dark: '#14151a' },
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
  gain: 'var(--gain)',
  loss: 'var(--loss)',
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
 * hue stays readable and « annoncé » is never signalled by colour alone.
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
    line.setAttribute('fill', color);
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
