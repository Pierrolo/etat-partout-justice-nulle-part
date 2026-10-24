/**
 * @epjn/engine — public API. Contract: docs/ENGINE-API.md.
 *  - pure TypeScript, ESM, no DOM, no I/O, no Date; deterministic;
 *  - the site imports this package as source (`exports` → ./src/index.ts, compiled by Vite);
 *  - `Tier` and `SourceRef` are used by the site's UI primitives — keep them stable.
 */
export const ENGINE_VERSION = '1.0.0';

export * from './types.ts';
export { DEFAULT_HYPOTHESES } from './hypotheses.ts';
export { simulate, COMPONENT_META } from './simulate.ts';
export { compare } from './compare.ts';
export { earningsCurve, type CurvePoint } from './curves.ts';
export { hourOfWork, type HourSplit } from './hour.ts';
export { CAS_TYPES, type CasType } from './cas-types.ts';
export { encodeState, decodeState } from './state.ts';
export { PARAMS } from './params/index.ts';

export const PARAMS_META = {
  baselineYear: 'Législation 2026 (état du droit au 24 octobre 2026 ; barème IR LF 2026)',
  planSource:
    'Amendements Résolution au PLF 2027 (1re et 2de parties) et au PLFSS 2027, 19 octobre 2026 ; fiches et manifeste france-resolution.fr ; classeurs « Synthèse » des auteurs',
  engineVersion: ENGINE_VERSION,
} as const;
