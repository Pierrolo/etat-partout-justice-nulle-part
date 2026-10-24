/**
 * Vite plugin: French typography for the JSON datasets, at build time.
 *
 * `src/data/*.json` come verbatim from the sources (straight apostrophes, regular spaces before
 * « : ; ? ! », « 10% »…). The pipeline must keep them verbatim, so the site normalises them on the way
 * in: every string goes through `typo()` (see lib/typo.ts) before Vite turns the JSON into a module.
 * Zero runtime cost; applies to every island and page that imports a dataset.
 */
import { typoDeep } from './typo.ts';

const DATA = /[\\/]src[\\/]data[\\/][^\\/]+\.json$/;

export function typoJson() {
  return {
    name: 'epjn-typo-json',
    enforce: 'pre',
    transform(code, id) {
      const path = id.split('?')[0];
      if (!DATA.test(path)) return null;
      if (/[\\/]manifest\.json$/.test(path)) return null; // checksums describe the raw files
      const value = JSON.parse(code);
      return {
        code: JSON.stringify(typoDeep(value, { spaceBeforePercent: true, enDash: true })),
        map: null,
      };
    },
  };
}
