import { describe, expect, it } from 'vitest';
import { cofogRows, cofogTree, squaresByGroup } from './story-data';

describe('story-data', () => {
  it('slims the COFOG tree', () => {
    const t = cofogTree();
    expect(t.children).toHaveLength(6);
    expect(t.children!.reduce((a, g) => a + g.value, 0)).toBeCloseTo(t.value, 1);
    expect(cofogRows(t).length).toBeGreaterThan(80);
  });
  it('allocates exactly 100 squares', () => {
    const t = cofogTree();
    const s = squaresByGroup(t.children!, t.value);
    expect(s.reduce((a, x) => a + x.squares, 0)).toBe(100);
  });
});
