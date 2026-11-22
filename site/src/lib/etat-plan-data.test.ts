import { describe, expect, it } from 'vitest';
import { num } from './facts';
import {
  agencyFates,
  agencyRows,
  democraticChain,
  lawWords,
  ministries,
  workforce,
} from './etat-data';
import { packAgencies, unpackAgencies } from './etat-shared';
import { lifecycleData, planSankey } from './plan-data';

describe('etat-data', () => {
  it('splits the 35 ministries into 7 kept, 9 absorbed, 19 removed', () => {
    const m = ministries();
    const count = (f: string) => m.dots.filter((d) => d.fate === f).length;
    expect(m.dots).toHaveLength(m.before);
    expect(count('garde')).toBe(m.after);
    expect(count('absorbe')).toBe(m.regrouped - m.after);
    expect(count('supprime')).toBe(m.removedOutright);
  });
  it('agency fates add up to the 1 104 agencies of facts.json', () => {
    const f = agencyFates();
    expect(f.reduce((a, x) => a + x.n, 0)).toBe(num('agences_etat_avant'));
    expect(f.find((x) => x.id === 'suppression')!.n + f.find((x) => x.id === 'cession')!.n).toBe(
      num('agences_fermees'),
    );
  });
  it('lists named agencies and round-trips the compact form', () => {
    const rows = agencyRows();
    expect(rows.length).toBeGreaterThan(800);
    expect(unpackAgencies(packAgencies(rows))).toEqual(rows);
  });
  it('keeps the series breaks and the workforce total', () => {
    expect(lawWords().breaks.map((b) => b.year)).toEqual([2010, 2012]);
    const w = workforce();
    expect(w.rows.reduce((a, r) => a + r.totalK, 0)).toBeCloseTo(w.totalK, 0);
    const c = democraticChain();
    expect(c.steps[0]!.value).toBe(100);
    expect(c.steps.at(-1)!.value).toBeCloseTo(3.45, 2);
  });
});

describe('plan-data', () => {
  it('uses the balanced Sankey only: inflows equal outflows', () => {
    const s = planSankey();
    const inflow = s.links.filter((l) => ['annee_1', 'annee_pleine'].includes(l.target));
    const outflow = s.links.filter((l) => ['salaire_net', 'capitalisation'].includes(l.target));
    const sum = (ls: { value: number }[]) => ls.reduce((a, l) => a + l.value, 0);
    expect(sum(inflow)).toBeCloseTo(s.total, 3);
    expect(sum(outflow)).toBeCloseTo(s.total, 3);
    // only the CSG/CRDS flow to net pay is written in the law
    expect(s.links.filter((l) => l.tier === 'law').map((l) => l.target)).toEqual(['salaire_net']);
  });
  it('lifecycle: the law-backed supports are 3 300 € per child and 6 600 € per adult', () => {
    const l = lifecycleData();
    expect(l.rows[0]!.aide_fondamentale).toBe(num('afu_enfant_eur_an'));
    expect(l.rows[30]!.aide_fondamentale).toBe(num('afu_adulte_eur_an'));
    expect(l.series.find((x) => x.id === 'aide_fondamentale')!.tier).toBe('law');
    expect(l.series.find((x) => x.id === 'compte_education')!.tier).toBe('announced');
  });
});
