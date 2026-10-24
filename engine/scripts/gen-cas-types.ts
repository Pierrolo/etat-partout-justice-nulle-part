/// <reference types="node" />
/** Writes engine/cas-types-results.json. Run: pnpm --filter @epjn/engine gen:cas-types */
import { writeFileSync } from 'node:fs';
import { casTypesResults } from './cas-types-results.ts';

const out = new URL('../cas-types-results.json', import.meta.url);
const data = casTypesResults();
writeFileSync(out, JSON.stringify(data, null, 2) + '\n');
console.log(`wrote ${data.cases.length} cas types (${data.winners} gagnants, ${data.losers} perdants) to ${out.pathname}`);
