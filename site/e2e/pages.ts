import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Every page of the production build, discovered from dist/ so that new pages added by other
 * agents are covered automatically. Returns URLs relative to baseURL: '' (home), 'simulateur/', …
 * (404.html is excluded: tested separately.)
 */
export function builtPages(dist = join(import.meta.dirname, '..', 'dist')): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name === '_astro') continue;
        walk(full);
      } else if (name === 'index.html') {
        const rel = relative(dist, dir).split('\\').join('/');
        out.push(rel === '' ? '' : `${rel}/`);
      }
    }
  };
  walk(dist);
  return out.sort();
}
