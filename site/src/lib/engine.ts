/**
 * THE ONE PLACE where the site reaches the calculation engine (`@epjn/engine`, docs/ENGINE-API.md).
 * Everything else imports from `@/lib/engine` (values) and `@/lib/engine-types` (types).
 * The engine is pure TypeScript with no DOM: it runs at build time (SSR of the islands) and in the browser.
 */
export {
  compare,
  decodeState,
  DEFAULT_HYPOTHESES,
  earningsCurve,
  encodeState,
  hourOfWork,
  CAS_TYPES,
  PARAMS_META,
  simulate,
} from '@epjn/engine';

export type * from './engine-types';
