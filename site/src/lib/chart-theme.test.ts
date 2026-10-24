import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  accent,
  categorical,
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
import { parseTokens } from './contrast';

const tokens = parseTokens(readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8'));

describe('chart-theme mirrors tokens.css', () => {
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
      expect(polarity.gain[mode]).toBe(tokens[mode]['--gain']);
      expect(polarity.loss[mode]).toBe(tokens[mode]['--loss']);
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
  it('sequential runs from the first to the last stop', () => {
    const f = sequentialInterpolator('light');
    expect(f(0)).toBe('rgb(228, 240, 255)');
    expect(f(1)).toBe('rgb(0, 56, 137)');
  });
  it('diverging is neutral at 0, loss at −1, gain at +1', () => {
    const f = divergingInterpolator('light');
    expect(f(0)).toBe('rgb(235, 232, 224)');
    expect(f(-1)).toBe('rgb(188, 63, 6)');
    expect(f(1)).toBe('rgb(0, 115, 122)');
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
