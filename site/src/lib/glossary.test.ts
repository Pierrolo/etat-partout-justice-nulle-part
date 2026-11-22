import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import raw from '@/data/glossaire.json';
import { GLOSSARY_IDS, glossaryEntries, lookupTerm } from './glossary';

const SRC = join(import.meta.dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(astro|tsx|ts)$/.test(name) && !/\.test\./.test(name)) out.push(full);
  }
  return out;
}

describe('glossaire', () => {
  it('couvre les sigles demandés (identifiants ou alias)', () => {
    const required = [
      'afu',
      'csg',
      'crds',
      'rsa',
      'prime-activite',
      'apl',
      'af',
      'cf',
      'ars',
      'asf',
      'paje',
      'cmg',
      'aah',
      'aeeh',
      'aspa',
      'cee',
      'tva',
      'quotient-familial',
      'decote',
      'revenu-disponible',
      'revenu-net-imposable',
      'foyer-fiscal',
      'menage',
      'zone-1',
      'zone-2',
      'zone-3',
      'taux-marginal',
      'niche-fiscale',
      'plf',
      'plfss',
      'amendement',
      'liasse',
      'cofog',
      'cep',
      'compte-education',
      'bouclier-sanitaire',
      'cotisations',
      'cout-employeur',
      'cnracl',
      'fonctionnaire',
      'dirigeant-assimile',
      'tns',
    ];
    for (const id of required) expect(lookupTerm(id), id).toBeDefined();
  });

  it('chaque définition tient en une ou deux phrases', () => {
    for (const e of glossaryEntries()) {
      expect(e.term.length, e.id).toBeGreaterThan(2);
      expect(e.definition.length, e.id).toBeGreaterThan(30);
      expect(e.definition.length, e.id).toBeLessThanOrEqual(330);
      // « 1,5 » ou « 0,5 » ne comptent pas comme fin de phrase : on cherche « . » suivi d’une majuscule.
      const sentences = e.definition.split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Þ«])/u);
      expect(sentences.length, `${e.id}: ${e.definition}`).toBeLessThanOrEqual(2);
    }
  });

  it('les alias ne se télescopent pas', () => {
    const seen = new Map<string, string>();
    for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
      if (id.startsWith('_')) continue;
      for (const key of [id, ...((v as { aliases?: string[] }).aliases ?? [])]) {
        expect(seen.has(key), `« ${key} » défini deux fois (${seen.get(key)} et ${id})`).toBe(
          false,
        );
        seen.set(key, id);
      }
    }
    expect(GLOSSARY_IDS.length).toBe(seen.size);
  });

  it('les liens « En savoir plus » restent sur le site', () => {
    for (const e of glossaryEntries()) if (e.href) expect(e.href).toMatch(/^\/[a-z0-9\-/#]*$/);
  });

  it('chaque <Term id> / <GlossaryTerm id> du code existe dans le glossaire', () => {
    const used: Array<{ file: string; id: string }> = [];
    for (const file of walk(SRC)) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/<(?:Term|GlossaryTerm)\s+id=["']([^"']+)["']/g)) {
        used.push({ file, id: m[1]! });
      }
    }
    for (const u of used) expect(lookupTerm(u.id), `${u.id} dans ${u.file}`).toBeDefined();
  });
});
