import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, evaluate, parseTokens } from './contrast';

const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');
const tokens = parseTokens(css);

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

  const results = evaluate(tokens);
  it('has no failing pair (WCAG 2.2 AA)', () => {
    const failing = results
      .filter((r) => !r.pass)
      .map(
        (r) =>
          `${r.mode}: ${r.fg} ${r.fgHex} on ${r.bg} ${r.bgHex} = ${r.ratio.toFixed(2)} < ${r.min} (${r.use})`,
      );
    expect(failing).toEqual([]);
  });
});
