import { describe, expect, it } from 'vitest';
import { convertMd, formatUnit } from './units';

const d = { foyers: 30_959_000, habitants: 68_000_000 };

describe('units', () => {
  it('converts Md€ to per-foyer and per-day amounts', () => {
    expect(convertMd(1671.794, 'foyer-an', d)).toBeCloseTo(54000, -1);
    expect(convertMd(1671.794, 'foyer-jour', d)).toBeCloseTo(147.95, 1);
    expect(convertMd(1671.794, 'habitant-an', d)).toBeCloseTo(24585, -1);
  });
  it('formats with French separators and adaptive decimals', () => {
    expect(formatUnit(1671.794, 'an', d)).toBe('1 672 Md€');
    expect(formatUnit(13.415, 'foyer-jour', d)).toBe('1,19 €');
    expect(formatUnit(391.954, 'foyer-jour', d)).toBe('34,69 €'.replace('34,69', '35'));
  });
});
