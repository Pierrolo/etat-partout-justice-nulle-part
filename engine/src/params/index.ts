import type { SourceRef } from '../types.ts';
import { BASELINE_PARAMS } from './baseline-2026.ts';
import { EXTRA_PARAMS } from './baseline-extra.ts';
import { PLAN_PARAMS } from './plan.ts';
import type { ParamMeta } from './types.ts';

export { BASELINE_META } from './baseline-2026.ts';
export type { ParamMeta } from './types.ts';

/** Every parameter of the engine, keyed by dotted path. */
export const PARAMS = { ...BASELINE_PARAMS, ...EXTRA_PARAMS, ...PLAN_PARAMS };
export type ParamKey = keyof typeof PARAMS;

/** Raw (typed) value of a parameter. */
export function pv<K extends ParamKey>(k: K): (typeof PARAMS)[K]['value'] {
  return PARAMS[k].value;
}

/** Numeric value of a parameter (throws if not a number: a programming error). */
export function n(k: ParamKey): number {
  const v: unknown = PARAMS[k].value;
  if (typeof v !== 'number') throw new Error(`param ${k} is not a number`);
  return v;
}

export function meta(k: ParamKey): ParamMeta {
  return PARAMS[k];
}

/** Deduplicated source references of a list of parameters (and extra literal refs). */
export function src(...items: Array<ParamKey | SourceRef>): SourceRef[] {
  const out: SourceRef[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const ref: SourceRef = typeof it === 'string' ? PARAMS[it].source : it;
    const key = `${ref.label}|${ref.url ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref.url ? { label: ref.label, url: ref.url } : { label: ref.label });
  }
  return out;
}
