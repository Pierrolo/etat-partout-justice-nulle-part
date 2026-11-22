/**
 * Regression tests for the round-2 fact-check of the engine and simulator (docs/qa/factcheck/round2-engine-simulator.md,
 * R2E-1…R2E-12 and the settled R2V items), checked against the authors' texts of 17–18 Nov 2026.
 */
import { describe, expect, it } from 'vitest';
import {
  compare,
  PARAMS,
  PARAMS_META,
  simulate,
  type Adult,
  type Household,
} from '../src/index.ts';

const sp = (x: string) => x.replace(/[  ]/g, ' ');
const amt = (r: { components: Array<{ id: string; amount: number }> }, id: string) =>
  r.components.find((c) => c.id === id)!.amount;
const retiree = (startYear: number): Adult => ({
  age: 70,
  activity: 'retraite',
  disability: 'none',
  pension: { amount: 1800, basis: 'brut', startYear },
});
const salaried = (status: 'prive' | 'fonctionnaire' = 'prive'): Adult => ({
  age: 40,
  activity: 'salarie',
  disability: 'none',
  salary: { amount: 2500, basis: 'brut', status },
});
const hh = (adults: Household['adults'], status: 'proprietaire' | 'locataire' = 'proprietaire') =>
  ({
    adults,
    marriedOrPacs: adults.length === 2,
    children: [],
    housing: status === 'locataire' ? { status, rentMonthly: 600 } : { status },
    benefits: { nonRecours: false },
  }) as Household;
const all = (h: Household) => {
  const u = compare(h).unquantified;
  return [...u.promises, ...u.losses];
};
const item = (h: Household, id: string) => {
  const it = all(h).find((x) => x.id === id)!;
  return { ...it, detail: sp(it.detail), amountHint: sp(it.amountHint ?? '') };
};

describe('round 2 — unquantified items', () => {
  it('R2E-1: the n° 26 indemnity is open to territorial civil servants by deliberation; not to the hospital service', () => {
    const fp = hh([salaried('fonctionnaire')]);
    for (const id of ['indemnite_agent_public', 'postes_publics']) {
      const d = item(fp, id).detail;
      expect(d).toMatch(/collectivité territoriale/);
      expect(d).toMatch(/délibération/);
      expect(d).toContain('la fonction publique hospitalière n’est pas visée');
      expect(d).not.toMatch(
        /territoriale et hospitalière ne sont pas visées|ne vise pas les fonctionnaires territoriaux/,
      );
    }
  });
  it('R2E-6: the 70 % applies to the TIB plus a décret share of primes (nil by default); 30 % drop while no décret', () => {
    const fp = hh([salaried('fonctionnaire')]);
    expect(item(fp, 'indemnite_agent_public').detail).toContain(
      '70 % d’une assiette égale au traitement indiciaire brut plus une part des primes',
    );
    expect(item(fp, 'indemnite_agent_public').detail).toContain('au plus un quart du traitement');
    const postes = item(fp, 'postes_publics').detail;
    expect(postes).toContain('une baisse de 30 % de votre traitement tant qu’aucun décret');
    expect(postes).not.toContain('au moins 30 %');
  });
  it('R2E-2: the complément viager has a legal mechanism (am. 27) but no voted amount and no 500 € floor', () => {
    const c = item(hh([retiree(2020)]), 'complement_viager');
    expect(c.detail).toContain('amendement PLF-P1 n° 27');
    expect(c.detail).toContain('rente viagère');
    expect(c.detail).toContain('nul à défaut');
    expect(c.detail).toContain('aucun plancher de 500 €');
    expect(c.detail).not.toContain('Aucun mécanisme juridique');
    expect(c.sources.map((s) => s.label).join(' ')).toContain('am. n° 27');
  });
  it('R2E-3 + R2V-1: current DMTO ≈ 12 640 € on 200 000 € (5 % in 88 départements); who pays is disputed', () => {
    const d = item(hh([salaried()], 'locataire'), 'droits_mutation');
    expect(d.title).not.toContain('payés par le vendeur');
    expect(d.detail).toContain('12 640 €');
    expect(d.detail).toContain('88 départements');
    expect(d.detail).toContain('1er juin 2026');
    expect(d.detail).toContain('Les sources divergent');
    expect(d.detail).toContain('« le vendeur pour une vente »');
    expect(d.detail).toContain('lors de l’acquisition');
    expect(d.amountHint).toContain('−8 700 €');
    expect(d.amountHint).not.toContain('6 100');
    expect(d.sources.map((s) => s.label).join(' ')).toContain('14771-PGP');
  });
  it('R2E-4: the 9 Md€ is sourced to the PLFSS am. 1 exposé; the fiche quote concerns the taxes sur les salaires', () => {
    const e = item(hh([salaried()]), 'exonerations_salaire');
    expect(e.detail).toContain('« rend 9 milliards d’euros au salaire net »');
    expect(e.detail).toContain('suppression des taxes sur les salaires « va au salarié');
    expect(e.sources[0]!.label).toContain('PLFSS');
    expect(e.sources[0]!.label).toContain('am. n° 1');
  });
  it('R2E-5: the workbook is « Synthèse des chiffrages » everywhere', () => {
    const labels = Object.values(PARAMS)
      .map((p) => p.source.label)
      .join(' ');
    expect(labels).not.toContain('Synthèse Chiffres');
    expect(labels).toContain('Synthèse des chiffrages');
  });
  it('R2E-7: rupture conventionnelle: 15 months below 55, 20,5 months from 55', () => {
    expect(item(hh([salaried()]), 'chomage_6_mois').detail).toContain(
      '15 mois avant 55 ans, 20,5 mois ensuite',
    );
  });
  it('R2E-10: APL: no new right for a claim filed from (and including) 1 June 2027; 12 months at most from 1 Jan 2027', () => {
    const loc = hh(
      [{ ...salaried(), salary: { amount: 900, basis: 'net', status: 'prive' } }],
      'locataire',
    );
    const apl = simulate(loc, 'plan').components.find((c) => c.id === 'aides_logement')!;
    expect(apl.formula).toContain('demande déposée à partir du 1er juin 2027');
    const it = item(loc, 'apl_nouveau_bail');
    expect(it.detail).toContain('à partir du 1er juin 2027');
    expect(it.detail).toContain('douze mois au plus');
  });
  it('R2V-2: bouclier floor = 5 % of the foyer’s own AFU (330 € single, 165 € retiree before 2028, 660 € couple)', () => {
    expect(item(hh([salaried()]), 'bouclier_sanitaire').detail).toContain(
      'soit 330 € par an pour vous',
    );
    expect(item(hh([retiree(2020)]), 'bouclier_sanitaire').detail).toContain(
      'soit 165 € par an pour vous',
    );
    expect(item(hh([salaried(), salaried()]), 'bouclier_sanitaire').detail).toContain(
      'soit 660 € par an pour vous',
    );
  });
});

describe('round 2 — AFU pension minoration per period', () => {
  it('R2E-11: a pension liquidated after 2051 never carries the minoration', () => {
    expect(amt(simulate(hh([retiree(2055)]), 'plan'), 'afu')).toBe(550);
    expect(amt(simulate(hh([retiree(2060)]), 'plan'), 'afu')).toBe(550);
    expect(amt(simulate(hh([retiree(2051)]), 'plan'), 'afu')).toBeLessThan(550);
    const w = compare(hh([retiree(2055)])).warnings.join(' ');
    expect(w).toContain('aucune minoration n’est appliquée');
    expect(compare(hh([retiree(2055)])).activeHypotheses.some((h) => h.id === 'H21')).toBe(false);
  });
  it('R2V-3: a pension liquidated in 2030 is not yet held in 2028: no minoration that year, with a warning', () => {
    const h = hh([retiree(2030)]);
    expect(amt(simulate(h, 'plan', { period: 2028 }), 'afu')).toBe(550);
    expect(amt(simulate(h, 'plan', { period: 2030 }), 'afu')).toBeCloseTo(
      550 - (275 * 162) / 172,
      1,
    );
    expect(amt(simulate(h, 'plan'), 'afu')).toBeCloseTo(550 - (275 * 162) / 172, 1);
    const c2028 = compare(h, { period: 2028 });
    expect(c2028.warnings.join(' ')).toContain('après l’année affichée (2028)');
    expect(c2028.activeHypotheses.some((x) => x.id === 'H21')).toBe(false);
    expect(compare(h, { period: 2027 }).warnings.join(' ')).not.toContain('après l’année affichée');
    expect(compare(h, { period: 2030 }).warnings.join(' ')).not.toContain('après l’année affichée');
    // a pension liquidated before 2028 is unaffected in every period
    expect(amt(simulate(hh([retiree(2020)]), 'plan', { period: 2028 }), 'afu')).toBe(275);
  });
});

describe('round 2 — labels', () => {
  it('R2E-9: 8 of the 9 prestations familiales are abolished (allocation de logement kept until 2030)', () => {
    expect(PARAMS['plan.prestations_familiales_end'].unit).toContain('8 of the 9');
  });
  it('R2E-12: the simulator footer gives both publication dates', () => {
    expect(PARAMS_META.planPublishedLabel).toBe('Amendements publiés les 17 et 18 novembre 2026');
  });
});
