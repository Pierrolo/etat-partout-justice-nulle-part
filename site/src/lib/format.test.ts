import { describe, expect, it } from 'vitest';
import {
  MINUS,
  NBSP,
  NNBSP,
  formatCompactEuro,
  formatEuro,
  formatEuroDelta,
  formatEuroPer,
  formatInteger,
  formatMdEuro,
  formatNumber,
  formatPercent,
  formatPercentPoints,
  parseFrenchNumber,
  reframe,
  reframeSentence,
  roundForDisplay,
} from './format';

/** Exact code points matter: make them visible in failures. */
const cp = (s: string) =>
  [...s]
    .map((c) =>
      c.charCodeAt(0) > 127
        ? `U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`
        : c,
    )
    .join(' ');

describe('formatEuro', () => {
  it('uses U+202F for thousands and U+00A0 before €', () => {
    expect(formatEuro(1234)).toBe(`1${NNBSP}234${NBSP}€`);
    expect(cp(formatEuro(1234567))).toBe('1 U+202F 2 3 4 U+202F 5 6 7 U+00A0 U+20AC');
  });
  it('rounds to whole euros by default and supports decimals', () => {
    expect(formatEuro(1234.56)).toBe(`1${NNBSP}235${NBSP}€`);
    expect(formatEuro(1234.5, { decimals: 2 })).toBe(`1${NNBSP}234,50${NBSP}€`);
    expect(formatEuro(12, { decimals: 'auto' })).toBe(`12${NBSP}€`);
    expect(formatEuro(12.3, { decimals: 'auto' })).toBe(`12,30${NBSP}€`);
  });
  it('groups 4-digit numbers (French has no minimum grouping)', () => {
    expect(formatEuro(9999)).toBe(`9${NNBSP}999${NBSP}€`);
  });
  it('uses a true minus sign', () => {
    expect(formatEuro(-40)).toBe(`${MINUS}40${NBSP}€`);
    expect(formatEuro(-40)).not.toContain('-');
  });
  it('never prints negative zero', () => {
    expect(formatEuro(-0.2)).toBe(`0${NBSP}€`);
    expect(formatEuroDelta(-0.2)).toBe(`0${NBSP}€`);
  });
  it('falls back for non-finite values', () => {
    expect(formatEuro(Number.NaN)).toBe('—');
    expect(formatEuro(Number.POSITIVE_INFINITY, { fallback: 'n.d.' })).toBe('n.d.');
  });
});

describe('formatEuroDelta / formatEuroPer', () => {
  it('signs deltas', () => {
    expect(formatEuroDelta(212)).toBe(`+212${NBSP}€`);
    expect(formatEuroDelta(-212)).toBe(`${MINUS}212${NBSP}€`);
    expect(formatEuroDelta(0)).toBe(`0${NBSP}€`);
  });
  it('appends the period without a space', () => {
    expect(formatEuroPer(212, 'mois', { signed: true })).toBe(`+212${NBSP}€/mois`);
    expect(formatEuroPer(148, 'jour')).toBe(`148${NBSP}€/jour`);
  });
});

describe('formatPercent', () => {
  it('formats ratios, with a non-breaking space before %', () => {
    expect(formatPercent(0.09)).toBe(`9${NBSP}%`);
    expect(formatPercent(0.571, { decimals: 1 })).toBe(`57,1${NBSP}%`);
    expect(formatPercent(0.09, { signed: true })).toBe(`+9${NBSP}%`);
    expect(formatPercent(-0.034, { decimals: 1, signed: true })).toBe(`${MINUS}3,4${NBSP}%`);
  });
  it('formats values already in percent', () => {
    expect(formatPercentPoints(57.1, { decimals: 1 })).toBe(`57,1${NBSP}%`);
  });
});

describe('formatNumber / formatInteger', () => {
  it('uses a decimal comma', () => {
    expect(formatNumber(1234.5, { decimals: 1 })).toBe(`1${NNBSP}234,5`);
    expect(formatNumber(0.5, { decimals: { min: 0, max: 2 } })).toBe('0,5');
  });
  it('formats counts', () => {
    expect(formatInteger(1104)).toBe(`1${NNBSP}104`);
    expect(formatInteger(49_000_000)).toBe(`49${NNBSP}000${NNBSP}000`);
  });
});

describe('compact euros', () => {
  it('formats milliards as Md€', () => {
    expect(formatCompactEuro(1.672e12)).toBe(`1${NNBSP}672${NBSP}Md€`);
    expect(formatCompactEuro(236e9)).toBe(`236${NBSP}Md€`);
    expect(formatCompactEuro(57.34e9)).toBe(`57,3${NBSP}Md€`);
    expect(formatCompactEuro(8.4e9)).toBe(`8,4${NBSP}Md€`);
    expect(formatCompactEuro(3e9)).toBe(`3${NBSP}Md€`);
  });
  it('formats millions, milliers and small amounts', () => {
    expect(formatCompactEuro(12.5e6)).toBe(`12,5${NBSP}M€`);
    expect(formatCompactEuro(45_000)).toBe(`45${NBSP}k€`);
    expect(formatCompactEuro(450)).toBe(`450${NBSP}€`);
  });
  it('supports the long form and signed values', () => {
    expect(formatCompactEuro(1.672e12, { long: true })).toBe(
      `1${NNBSP}672${NBSP}milliards d’euros`,
    );
    expect(formatCompactEuro(1.2e9, { long: true })).toBe(`1,2${NBSP}milliard d’euros`);
    expect(formatCompactEuro(-3.5e9, { signed: true })).toBe(`${MINUS}3,5${NBSP}Md€`);
  });
  it('formatMdEuro takes milliards directly', () => {
    expect(formatMdEuro(1672)).toBe(`1${NNBSP}672${NBSP}Md€`);
  });
});

describe('roundForDisplay', () => {
  it('rounds to the step', () => {
    expect(roundForDisplay(212.4)).toBe(210);
    expect(roundForDisplay(213)).toBe(215);
    expect(roundForDisplay(-2, 5)).toBe(0);
    expect(roundForDisplay(-212, 10)).toBe(-210);
  });
});

describe('parseFrenchNumber', () => {
  it.each([
    ['1 234,5', 1234.5],
    [`1${NNBSP}234,5`, 1234.5],
    [`1${NBSP}234`, 1234],
    ['1234.5', 1234.5],
    ['1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['2 500 €', 2500],
    ['2500€/mois', 2500],
    ['−40', -40],
    ['-40,5', -40.5],
    ['+12', 12],
    ['0', 0],
    [',5', 0.5],
    ['12.', 12],
  ])('parses %j → %d', (input, expected) => {
    expect(parseFrenchNumber(input)).toBeCloseTo(expected, 10);
  });
  it.each(['', '   ', 'abc', '-', '1,2,3x', '12 34 abc'])('rejects %j', (input) => {
    expect(parseFrenchNumber(input)).toBeNull();
  });
  it('round-trips formatted output', () => {
    for (const n of [0, 1, 12, 1234, 98765.5, -4321.25]) {
      expect(parseFrenchNumber(formatNumber(n, { decimals: { min: 0, max: 2 } }))).toBeCloseTo(
        n,
        6,
      );
    }
  });
});

describe('reframe', () => {
  it('converts a national total to a household', () => {
    const r = reframe({ annualTotal: 1.672e12, households: 30e6 });
    expect(r.perHouseholdYear).toBeCloseTo(55_733.33, 1);
    expect(r.perHouseholdMonth).toBeCloseTo(4_644.44, 1);
    expect(r.perHouseholdDay).toBeCloseTo(152.69, 1);
  });
  it('writes the sentence', () => {
    const r = reframe({ annualTotal: 54_020, households: 1 });
    expect(reframeSentence(r, 'jour')).toBe(`=${NBSP}148${NBSP}€ par foyer et par jour`);
    expect(reframeSentence(r, 'mois')).toContain('par foyer et par mois');
  });
  it('rejects zero households', () => {
    expect(() => reframe({ annualTotal: 1, households: 0 })).toThrow(RangeError);
  });
});
