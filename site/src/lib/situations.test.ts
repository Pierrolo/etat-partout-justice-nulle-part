import { describe, expect, it } from 'vitest';
import data from '@/data/fiches.json';
import {
  SITUATION_FOR_PROFILE,
  SITUATION_SLUGS,
  isSituationSlug,
  situationGroups,
} from './situations';

describe('situations', () => {
  const groups = situationGroups();
  const all = groups.flatMap((g) => g.situations);

  it('reprend les 18 fiches, regroupées comme dans le livre', () => {
    expect(all).toHaveLength(18);
    expect(groups.map((g) => g.label)).toEqual(data.meta.groups.map((g) => g.label_fr));
    expect(new Set(all.map((s) => s.slug)).size).toBe(18);
  });

  it('garde gains et pertes mot pour mot', () => {
    const fiches = data.fiches as unknown as Array<{
      slug: string;
      gains: Array<{ text_fr: string; sub_items_fr: string[] }>;
      pertes: Array<{ text_fr: string }>;
    }>;
    for (const f of fiches) {
      const s = all.find((x) => x.slug === f.slug)!;
      expect(s.gains.map((g) => g.text)).toEqual(f.gains.map((g) => g.text_fr));
      expect(s.gains.map((g) => g.subItems)).toEqual(f.gains.map((g) => g.sub_items_fr));
      expect(s.pertes.map((p) => p.text)).toEqual(f.pertes.map((p) => p.text_fr));
    }
  });

  it('restitue les sous-points des fiches Travailleur et Jeune adulte, et compte comme l’en-tête', () => {
    const travailleur = all.find((s) => s.slug === 'travailleur')!;
    const jeune = all.find((s) => s.slug === 'jeune-adulte')!;
    expect(travailleur.gains.flatMap((g) => g.subItems)).toHaveLength(3);
    expect(jeune.gains.flatMap((g) => g.subItems)).toHaveLength(5);
    // l'en-tête de ces deux fiches annonce 8 gains : 5 + 3 et 3 + 5
    expect(travailleur.gainsCount).toBe(travailleur.gains.length + 3);
    expect(jeune.gainsCount).toBe(jeune.gains.length + 5);
    expect(travailleur.headerMismatch).toBeUndefined();
    expect(jeune.headerMismatch).toBeUndefined();
  });

  it('n’invente pas « 0 perte » quand l’en-tête n’annonce aucun compte de pertes', () => {
    const contribuable = all.find((s) => s.slug === 'contribuable')!;
    expect(contribuable.headerMismatch?.pertes).toBeNull();
  });

  it('ajoute, hors fiche, la minoration de pension de l’amendement n° 28 à la fiche Retraité', () => {
    const retraite = all.find((s) => s.slug === 'retraite')!;
    expect(retraite.siteNote).toMatch(/Note du site, hors fiche/);
    expect(retraite.siteNote).toMatch(/minore/);
    expect(retraite.gains.map((g) => g.text).join(' ')).not.toMatch(/minor/);
  });

  it('chaque amendement lié existe et renvoie vers son PDF', () => {
    for (const s of all) {
      expect(s.amendements.length, s.slug).toBeGreaterThan(0);
      for (const a of s.amendements) {
        expect(a.pdfUrl, `${s.slug} ${a.id}`).toMatch(/^https:\/\/france-resolution\.fr\//);
        expect(a.label).toMatch(/^Amendement (PLF-P1|PLF-P2|PLFSS) n° \d+$/);
      }
    }
  });

  it('expose les ancres promises au simulateur', () => {
    for (const slug of ['agent-public-indispensable', 'enseignant', 'retraite', 'entreprise']) {
      expect(isSituationSlug(slug)).toBe(true);
    }
    for (const slug of Object.values(SITUATION_FOR_PROFILE))
      expect(SITUATION_SLUGS).toContain(slug);
  });

  it('signale les en-têtes qui ne correspondent pas aux éléments listés (D23)', () => {
    const mismatch = all.filter((s) => s.headerMismatch).map((s) => s.slug);
    expect(mismatch.sort()).toEqual([...data.meta.header_mismatch_slugs].sort());
  });
});
