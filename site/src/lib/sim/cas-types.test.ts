import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@/lib/contrast';
import { CAS_TYPES, compare, DEFAULT_HYPOTHESES } from '@/lib/engine';
import { bucketOf, buildRows, families, INCOME_BUCKETS, tileColor } from './cas-types';

describe('income buckets', () => {
  it('cover every income exactly once', () => {
    for (const v of [0, 1, 1499, 1500, 2499.99, 2500, 4999, 5000, 6999, 7000, 1e6]) {
      expect(INCOME_BUCKETS.filter((b) => v >= b.min && v < b.max)).toHaveLength(1);
    }
    expect(bucketOf(1478).id).toBe('b0');
    expect(bucketOf(1500).id).toBe('b1');
  });
});

describe('tile colours', () => {
  it('text is readable (≥ 4.5 : 1) at every point of the diverging scale, in both themes', () => {
    for (let i = -100; i <= 100; i++) {
      const c = tileColor(i / 100);
      expect(contrastRatio(c.bgLight, c.fgLight)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c.bgDark, c.fgDark)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('losses are warm and gains are cool at the extremes (never the reverse)', () => {
    const loss = tileColor(-1).bgLight;
    const gain = tileColor(1).bgLight;
    const r = (h: string) => parseInt(h.slice(1, 3), 16);
    const b = (h: string) => parseInt(h.slice(5, 7), 16);
    expect(r(loss)).toBeGreaterThan(b(loss));
    expect(b(gain)).toBeGreaterThan(r(gain));
  });
});

describe('case rows', () => {
  it('computes one row per case type with consistent figures', () => {
    const rows = buildRows(CAS_TYPES, compare, 'steady', DEFAULT_HYPOTHESES);
    expect(rows).toHaveLength(CAS_TYPES.length);
    for (const r of rows) {
      expect(r.plan - r.baseline).toBe(r.delta);
      expect(Number.isFinite(r.income)).toBe(true);
    }
    expect(families(rows).length).toBeGreaterThan(1);
  });
});
