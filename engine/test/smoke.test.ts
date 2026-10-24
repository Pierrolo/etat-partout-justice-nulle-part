import { describe, expect, it } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { ENGINE_VERSION, TIERS, simulate } from '../src/index';

describe('engine skeleton', () => {
  it('exposes a version and the three tiers', () => {
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(new Set(TIERS).size).toBe(3);
  });

  it('simulate() is a stub until the engine builder fills it in', () => {
    expect(() => simulate({ adults: 1, children: 0 }, 'plan')).toThrow(/not implemented/);
  });

  // Proves fast-check is wired through vitest; real invariants live in VISION §7.
  test.prop([fc.array(fc.integer({ min: -1000, max: 1000 }))])(
    'sum of integers does not depend on order',
    (xs) => {
      const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
      expect(sum([...xs].reverse())).toBe(sum(xs));
    },
  );
});
