import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  accent,
  categorical,
  categoricalNames,
  chrome,
  css,
  diverging,
  divergingInterpolator,
  fr,
  otherColor,
  polarity,
  sequential,
  sequentialInterpolator,
  series,
} from './chart-theme';
import { NBSP, NNBSP } from './format';
import { contrastRatio, parseTokens, resolveLook } from './contrast';

const read = (name: string) => readFileSync(new URL(`../styles/${name}`, import.meta.url), 'utf8');
/** The tokens in force: tokens.css (base) with brand-ci.css (the shipped look) on top. */
const tokens = resolveLook(parseTokens(read('tokens.css')), parseTokens(read('brand-ci.css')));

describe('chart-theme mirrors the tokens in force', () => {
  for (const mode of ['light', 'dark'] as const) {
    it(`categorical (${mode})`, () => {
      expect(categorical[mode]).toEqual(
        [1, 2, 3, 4, 5, 6, 7, 8].map((n) => tokens[mode][`--series-${n}`]),
      );
      expect(otherColor[mode]).toBe(tokens[mode]['--series-other']);
    });
    it(`sequential (${mode})`, () => {
      expect(sequential[mode]).toEqual(
        [1, 2, 3, 4, 5, 6, 7].map((n) => tokens[mode][`--seq-${n}`]),
      );
    });
    it(`diverging + polarity + accent + chrome (${mode})`, () => {
      expect(diverging[mode].gain).toEqual(
        [4, 3, 2, 1].map((n) => tokens[mode][`--div-gain-${n}`]),
      );
      expect(diverging[mode].loss).toEqual(
        [1, 2, 3, 4].map((n) => tokens[mode][`--div-loss-${n}`]),
      );
      expect(diverging[mode].mid).toBe(tokens[mode]['--div-mid']);
      expect(polarity.gain[mode]).toBe(tokens[mode]['--gain-mark']);
      expect(polarity.loss[mode]).toBe(tokens[mode]['--loss-mark']);
      expect(accent[mode]).toBe(tokens[mode]['--accent']);
      expect(chrome.grid[mode]).toBe(tokens[mode]['--chart-grid']);
      expect(chrome.axis[mode]).toBe(tokens[mode]['--chart-axis']);
      expect(chrome.ink[mode]).toBe(tokens[mode]['--ink']);
      expect(chrome.ink2[mode]).toBe(tokens[mode]['--ink-2']);
      expect(chrome.ink3[mode]).toBe(tokens[mode]['--ink-3']);
      expect(chrome.surface[mode]).toBe(tokens[mode]['--surface']);
      expect(chrome.paper[mode]).toBe(tokens[mode]['--paper']);
    });
  }
});

describe('series()', () => {
  it('returns slot variables in order and folds the tail into « Autres »', () => {
    expect(series(0)).toBe('var(--series-1)');
    expect(series(7)).toBe('var(--series-8)');
    expect(series(8)).toBe(css.other);
    expect(series(-1)).toBe(css.other);
  });
});

describe('interpolators', () => {
  it('sequential runs from the first to the last stop (teal ramp)', () => {
    const light = sequentialInterpolator('light');
    expect(light(0)).toBe('rgb(214, 228, 222)');
    expect(light(1)).toBe('rgb(9, 61, 55)');
    expect(sequentialInterpolator('dark')(0)).toBe('rgb(28, 58, 53)');
  });
  it('diverging is neutral at 0, loss at −1, gain at +1 (teal gain, signal-orange loss)', () => {
    const f = divergingInterpolator('light');
    expect(f(0)).toBe('rgb(236, 233, 223)');
    expect(f(-1)).toBe('rgb(196, 60, 6)');
    expect(f(1)).toBe('rgb(15, 94, 85)');
    expect(f(5)).toBe(f(1));
  });
});

describe('French tick formatters', () => {
  it('format with the exact separators', () => {
    expect(fr.euro(1234)).toBe(`1${NNBSP}234${NBSP}€`);
    expect(fr.percent(0.57)).toBe(`57${NBSP}%`);
    expect(fr.compactEuro(1.672e12)).toBe(`1${NNBSP}672${NBSP}Md€`);
  });
});

describe('chart-theme names', () => {
  it('names its 8 slots', () => {
    expect(categoricalNames).toHaveLength(8);
    expect(categorical.light).toHaveLength(8);
    expect(categorical.dark).toHaveLength(8);
  });
});

describe('text on the greys of « Votre heure de travail » (--on-tint-n)', () => {
  const mix = (a: string, b: string, pctA: number) => {
    const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
    const m = (i: number) => Math.round((ch(a, i) * pctA + ch(b, i) * (100 - pctA)) / 100);
    return `#${[0, 1, 2].map((i) => m(i).toString(16).padStart(2, '0')).join('')}`;
  };
  for (const mode of ['light', 'dark'] as const) {
    it(`${mode}: every grey is a mark (≥ 3 : 1 on the card) and its text reads (≥ 4.5 : 1)`, () => {
      for (const pct of [90, 78, 66, 56, 48]) {
        const bg = mix(tokens[mode]['--ink']!, tokens[mode]['--surface']!, pct);
        expect(contrastRatio(bg, tokens[mode]['--surface']!)).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(tokens[mode][`--on-tint-${pct}`]!, bg)).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
