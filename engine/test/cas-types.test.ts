/** Snapshot of the CAS_TYPES comparison deltas (also exported as engine/cas-types-results.json). */
import { describe, expect, it } from 'vitest';
import { CAS_TYPES } from '../src/index.ts';
import { casTypesResults } from '../scripts/cas-types-results.ts';

describe('CAS_TYPES', () => {
  it('has about 40 unique standard households spanning the fiches', () => {
    expect(CAS_TYPES.length).toBeGreaterThanOrEqual(38);
    expect(new Set(CAS_TYPES.map((c) => c.id)).size).toBe(CAS_TYPES.length);
    expect(new Set(CAS_TYPES.map((c) => c.family)).size).toBeGreaterThanOrEqual(8);
  });
  it('comparison deltas (snapshot)', () => {
    expect(casTypesResults()).toMatchSnapshot();
  });
});
