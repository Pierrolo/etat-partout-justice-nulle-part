/**
 * Regression tests for engine 1.2.0: the plan as republished by its authors on 17–18 Nov 2026
 * (research/DIFF-2026-10-to-2026-11.md) and the plan-side fact-check findings (docs/qa/factcheck/plan-engine.md
 * PE-1…PE-12, simulator-methode.md E2/E4/E5/E11/E12, VERIFIED-nonplan.md rows 10–11).
 */
import { describe, expect, it } from 'vitest';
import {
  CAS_TYPES,
  compare,
  decodeState,
  DEFAULT_HYPOTHESES,
  earningsCurve,
  employerView,
  encodeState,
  ENGINE_VERSION,
  hourOfWork,
  PARAMS,
  PARAMS_META,
  simulate,
  type Adult,
  type Household,
} from '../src/index.ts';
import { defaultShareBefore2028 } from '../src/plan/afu.ts';

/** normalise the narrow / no-break spaces of the French number format */
const sp = (x: string) => x.replace(/[\u00a0\u202f]/g, ' ');
const amt = (r: { components: Array<{ id: string; amount: number }> }, id: string) =>
  r.components.find((c) => c.id === id)!.amount;
const comp = (r: ReturnType<typeof simulate>, id: string) => {
  const c = r.components.find((x) => x.id === id)!;
  return { ...c, formula: sp(c.formula) };
};
const cas = (id: string) => structuredClone(CAS_TYPES.find((c) => c.id === id)!.household);

const retiree = (startYear: number, share?: number, gross = 1800): Adult => ({
  age: 70,
  activity: 'retraite',
  disability: 'none',
  pension: {
    amount: gross,
    basis: 'brut',
    startYear,
    ...(share === undefined ? {} : { insuranceShareBefore2028: share }),
  },
});
const hh = (adults: Household['adults'], children: Household['children'] = []): Household => ({
  adults,
  marriedOrPacs: adults.length === 2,
  children,
  housing: { status: 'proprietaire' },
  benefits: { nonRecours: false },
});
const salaried = (gross = 1867.02): Adult => ({
  age: 40,
  activity: 'salarie',
  disability: 'none',
  salary: { amount: gross, basis: 'brut', status: 'prive' },
});

describe('PLF-P1 n° 28 (Nov 2026): the pension supplement became a minoration of 3 300 €/an', () => {
  it('parameters: 3 300 € minoration, 2028 cut-off, until IR on 2051 incomes, 172-quarter default', () => {
    expect(PARAMS['plan.afu_pension_minoration'].value).toBe(3300);
    expect(PARAMS['plan.afu_pension_minoration'].status).toBe('legal_text');
    expect(PARAMS['plan.afu_pension_cutoff_year'].value).toBe(2028);
    expect(PARAMS['plan.afu_pension_last_income_year'].value).toBe(2051);
    expect(PARAMS['plan.afu_pension_default_career_quarters'].status).toBe('hypothesis');
    expect('plan.afu_pension' in PARAMS).toBe(false);
  });
  it('pension liquidated before 2028: AFU 6 600 − 3 300 = 3 300 €/an (275 €/mois) per holder', () => {
    expect(amt(simulate(hh([retiree(2018)]), 'plan'), 'afu')).toBe(275);
    expect(amt(simulate(hh([retiree(2018), retiree(2020)]), 'plan'), 'afu')).toBe(550);
    // the minoration is per member holding a pension, not per pension, and never touches a non-pensioner
    expect(amt(simulate(hh([retiree(2018), salaried()]), 'plan'), 'afu')).toBe(275 + 550);
  });
  it('a retiree whose pension is 0 € (not yet paid) has no minoration', () => {
    expect(amt(simulate(hh([retiree(2018, undefined, 0)]), 'plan'), 'afu')).toBe(550);
  });
  it('pension liquidated from 2028: 3 300 € × share of the insurance duration validated before 2028', () => {
    for (const share of [0, 0.25, 0.5, 1]) {
      const afu = amt(simulate(hh([retiree(2035, share)]), 'plan'), 'afu');
      expect(afu).toBeCloseTo(550 - 275 * share, 1);
    }
    // the declared share is ignored for a pension liquidated before 2028 (whole minoration)
    expect(amt(simulate(hh([retiree(2020, 0.1)]), 'plan'), 'afu')).toBe(275);
  });
  it('default share: full career of 172 quarters ending on 1 July of the start year', () => {
    expect(defaultShareBefore2028(2028)).toBeCloseTo(170 / 172, 12);
    expect(defaultShareBefore2028(2030)).toBeCloseTo(162 / 172, 12);
    expect(defaultShareBefore2028(2070)).toBeCloseTo(2 / 172, 12);
    expect(defaultShareBefore2028(2071)).toBe(0);
    expect(amt(simulate(hh([retiree(2030)]), 'plan'), 'afu')).toBeCloseTo(
      550 - (275 * 162) / 172,
      1,
    );
  });
  it('formula, sources and tier: law when the share is known, hypothesis when the default is used', () => {
    const before = comp(simulate(hh([retiree(2018)]), 'plan'), 'afu');
    expect(before.tier).toBe('law');
    expect(before.formula).toContain(
      '− 3 300 € × 1 titulaire d’une pension de retraite liquidée avant 2028',
    );
    expect(before.formula).toContain('jusqu’à l’impôt sur les revenus de 2051');
    const declared = comp(simulate(hh([retiree(2032, 0.6)]), 'plan'), 'afu');
    expect(declared.tier).toBe('law');
    expect(declared.formula).toContain('pension liquidée en 2032');
    expect(declared.formula).toContain('60 %');
    const dflt = comp(simulate(hh([retiree(2032)]), 'plan'), 'afu');
    expect(dflt.tier).toBe('hypothesis');
    expect(dflt.formula).toContain('172 trimestres');
    expect(dflt.sources.map((s) => s.label).join(' ')).toContain('Hypothèse du simulateur');
  });
  it('warning, hypothesis H21 and summary phrase', () => {
    const c = compare(hh([retiree(2030)]));
    expect(c.warnings.some((w) => /minoration de 3 300 € par an/.test(sp(w)))).toBe(true);
    expect(sp(c.warnings.join(' '))).not.toMatch(/majoration de 3 300/);
    const h21 = c.activeHypotheses.find((h) => h.id === 'H21')!;
    expect(h21.tier).toBe('hypothesis');
    expect(h21.value).toContain('régime obligatoire');
    const old = compare(hh([retiree(2018)]));
    expect(old.activeHypotheses.find((h) => h.id === 'H21')!.tier).toBe('law');
    expect(old.warnings.join(' ')).not.toMatch(/Pension liquidée/);
    const why = sp([old.summary.why, ...old.summary.gains.map((g) => g.label)].join(' '));
    expect(why).toMatch(/275 € de moins par mois pour votre pension de retraite/);
  });
  it('transition: no AFU (hence no minoration) in 2027; minoration from 2028', () => {
    const h = hh([retiree(2018)]);
    expect(amt(simulate(h, 'plan', { period: 2027 }), 'afu')).toBe(0);
    expect(amt(simulate(h, 'plan', { period: 2028 }), 'afu')).toBe(275);
    expect(amt(simulate(h, 'plan', { period: 2030 }), 'afu')).toBe(275);
  });
  it('hourOfWork: a salaried adult keeps 550 €/mois even when the partner is a retiree', () => {
    const h = hh([salaried(), retiree(2018)]);
    const w = hourOfWork(h, 0);
    expect(w.plan.afuMonthly).toBe(550);
  });
  it('earningsCurve: the plan curve carries the partner’s minoration (matches simulate at the same salary)', () => {
    const h: Household = {
      ...hh([salaried(), retiree(2018)]),
      adults: [
        { ...salaried(), salary: { amount: 2000, basis: 'net', status: 'prive' } },
        retiree(2018),
      ],
    };
    const last = earningsCurve(h, { maxNet: 2000, step: 1000 }).at(-1)!;
    expect(last.netToday).toBe(2000);
    const s = simulate(h, 'plan');
    expect(amt(s, 'afu')).toBe(550 + 275);
    expect(last.plan).toBeCloseTo(s.disposable, 6);
  });
  it('input: share clamped to [0 ; 1] with a warning; URL state round-trips it; old hashes unchanged', () => {
    const c = compare(hh([retiree(2035, 1.4)]));
    expect(c.warnings.some((w) => /ramenée dans \[0 ; 100 %\]/.test(w))).toBe(true);
    expect(amt(c.plan, 'afu')).toBeCloseTo(275, 1);
    const h = hh([retiree(2035, 0.37)]);
    const s = encodeState(h, DEFAULT_HYPOTHESES, 'steady');
    expect(decodeState(s)!.household).toEqual(h);
    const old = encodeState(hh([retiree(2018)]), DEFAULT_HYPOTHESES, 'steady');
    const json = JSON.parse(
      Buffer.from(old.slice(3).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(),
    );
    expect(json[1][0][0][4]).toHaveLength(3);
  });
  it('cas-types: the six pre-2028 retiree cases now lose; retraite-2028 carries a pro-rata minoration', () => {
    for (const id of [
      'retraite-aspa',
      'retraite-1200',
      'retraite-1800',
      'retraite-3000',
      'retraite-couple-3200',
      'retraite-couple-6000',
      'retraite-2028',
    ])
      expect(compare(cas(id)).delta).toBeLessThan(0);
    const r28 = compare(cas('retraite-2028'));
    expect(amt(r28.plan, 'afu')).toBeCloseTo(550 - (275 * 170) / 172, 1);
  });
});

describe('Book cas types re-validated against the Nov 2026 text', () => {
  it('pensioner (pension 2020) with one child: 550 + 275 − 275 = 550 €/mois (was 1 100 in October)', () => {
    expect(amt(simulate(hh([retiree(2020)], [{ age: 10 }]), 'plan'), 'afu')).toBe(550);
  });
  it('adult with the CMI « invalidité », no income: still 1 100 €/mois', () => {
    const h = hh([{ age: 40, activity: 'inactif', disability: 'aah_80' }]);
    expect(amt(simulate(h, 'plan'), 'afu')).toBe(1100);
  });
});

describe('Plan-side fact-check findings (plan-engine.md), checked against the Nov 2026 text', () => {
  const losses = (h: Household) => compare(h).unquantified.losses;
  const promises = (h: Household) => compare(h).unquantified.promises;
  const item = (list: ReturnType<typeof losses>, id: string) => list.find((x) => x.id === id)!;

  it('PE-1: intéressement/participation end with the IR on 2028 incomes, overtime and titres-restaurant 2026', () => {
    const it1 = item(losses(cas('seul-1')), 'titres_restaurant_heures_sup');
    expect(it1.detail).toContain('2026 (heures supplémentaires, titres-restaurant)');
    expect(it1.detail).toContain('2028 (intéressement, participation)');
  });
  it('PE-2 / E4: ARE durations with today’s age bands; « treize » only inside the fiche quote', () => {
    const inactiveWorker = item(losses(cas('seul-1')), 'chomage_6_mois');
    expect(inactiveWorker.detail).toContain(
      '548 jours avant 55 ans, 685 jours à 55-56 ans, 822 jours à partir de 57 ans',
    );
    expect(inactiveWorker.detail).toContain(
      'rupture conventionnelle depuis le 1er septembre 2026 : 15 mois avant 55 ans, 20,5 mois ensuite',
    );
    expect(inactiveWorker.amountHint).toBe(
      'en cas de perte d’emploi : 6 mois d’indemnisation au lieu de 6 à 18 mois aujourd’hui (jusqu’à 27 mois à partir de 57 ans)',
    );
    expect(inactiveWorker.detail.replace('« passe de treize à six mois »', '')).not.toMatch(
      /treize|13 à 18/,
    );
  });
  it('PE-3: the CEE source is PLF-P1 am. 16 only', () => {
    expect(PARAMS['plan.cee_end'].source.label).toContain('am. n° 16');
    const cee = compare(cas('seul-1')).plan.components.find((c) => c.id === 'cee')!;
    expect(cee.sources.map((s) => s.label).join(' ')).not.toContain('14-16');
  });
  it('PE-4: main-residence capital-gains exemption abolished from 1 Jan 2027, no hedge', () => {
    const pv = item(losses(cas('retraite-1800')), 'plus_value_residence');
    expect(pv.title).not.toMatch(/vérifier/);
    expect(pv.detail).not.toMatch(/semble-t-il|confirmer/);
    expect(pv.detail).toContain('n° 20, I 3°');
    expect(pv.detail).toContain('1er janvier 2027');
  });
  it('PE-5 / E12: the social-housing sentence cites PLF-P2 am. 29', () => {
    const ps = item(losses(cas('seul-1')), 'parc_social');
    expect(ps.sources.map((s) => s.label).join(' ')).toContain('2de partie, am. n° 29');
    expect(ps.detail).toContain('amendement PLF-P2 n° 29');
  });
  it('PE-6: indexation cites PLF-P2 am. 28 (AAH, RSA, PA) and PLFSS am. 5 (basic pensions only)', () => {
    const g = item(losses(cas('retraite-1800')), 'gel_indexation');
    const labels = g.sources.map((s) => s.label).join(' | ');
    expect(labels).toContain('2de partie, am. n° 28');
    expect(labels).toContain('PLFSS 2027, am. n° 5');
    expect(g.detail).toContain('pensions des régimes de base');
    expect(g.detail).toContain('Agirc-Arrco');
  });
  it('PE-7 / E5: the employer note no longer says the plan leaves employer contributions untouched', () => {
    const v = employerView(2500, 'brut', 'prive');
    const txt = v.notes.join(' ');
    expect(txt).not.toMatch(/ne modifie pas les cotisations patronales/);
    expect(txt).toContain('sans exonération particulière');
    expect(txt).toContain('1er juillet 2027');
  });
  it('PE-8: H13 rests on « chaque personne majeure composant le foyer fiscal » (am. 28), not on art. 196 B', () => {
    const h = hh([salaried()], [{ age: 20 }]);
    const h13 = compare(h).activeHypotheses.find((x) => x.id === 'H13')!;
    expect(h13.value).toContain('chaque personne majeure composant le foyer fiscal');
    expect(h13.value).not.toContain('196 B');
  });
  it('PE-9: H12 and H3 are tiered as simulator choices where they are', () => {
    const c = compare(cas('seul-1'));
    expect(c.activeHypotheses.find((x) => x.id === 'H12')!.tier).toBe('hypothesis');
    expect(c.activeHypotheses.find((x) => x.id === 'H3')!.tier).toBe('hypothesis');
    expect(c.activeHypotheses.find((x) => x.id === 'H3')!.value).toContain('10 %');
    const off = compare(cas('seul-1'), { hypotheses: { H2_fraisPro10: false } });
    expect(off.activeHypotheses.find((x) => x.id === 'H3')!.tier).toBe('law');
  });
  it('PE-10: pension_nette is « Notre estimation » when the CSG tier is recomputed (steady, 2030), not in 2027', () => {
    const h = cas('retraite-1800');
    expect(comp(simulate(h, 'plan'), 'pension_nette').tier).toBe('hypothesis');
    expect(comp(simulate(h, 'plan', { period: 2030 }), 'pension_nette').tier).toBe('hypothesis');
    expect(comp(simulate(h, 'plan', { period: 2027 }), 'pension_nette').tier).toBe('law');
    expect(comp(simulate(h, 'baseline'), 'pension_nette').tier).toBe('law');
  });
  it('PE-11 (+ V-2): the bouclier covers participations forfaitaires and franchises, foyer fiscal, net of IR', () => {
    const b = item(promises(cas('seul-1')), 'bouclier_sanitaire');
    expect(b.detail).toContain(
      'participations forfaitaires, des franchises et du forfait journalier',
    );
    expect(b.detail).toContain('foyer fiscal, diminuées de l’impôt sur le revenu');
    expect(b.detail).toContain('330 € pour une personne seule');
  });
  it('PE-12a: the ALD point is flagged as amendment text (PLFSS n° 4) inside the announced item', () => {
    const r = item(losses(cas('seul-1')), 'reste_a_charge_10');
    expect(r.tier).toBe('announced');
    expect(r.detail).toContain('écrit dans l’amendement PLFSS n° 4');
  });
  it('PE-12b + PLF-P2 n° 26 (Nov 2026) + R2E-1: State of right, territorial by deliberation; 24 months + 1 per quarter, ≤ 84 months', () => {
    const fp = cas('seul-1');
    fp.adults[0]!.salary!.status = 'fonctionnaire';
    const ind = item(promises(fp), 'indemnite_agent_public');
    expect(ind.title).toContain('État ; territorial sur délibération');
    expect(ind.detail).toContain('une collectivité territoriale (ou son établissement public)');
    expect(ind.detail).toContain('la fonction publique hospitalière n’est pas visée');
    expect(ind.detail).not.toMatch(/territoriale et hospitalière ne sont pas visées/);
    expect(ind.detail).toContain('24 mois augmentés d’un mois par trimestre de services publics');
    expect(ind.detail).toContain('au plus 84 mois (7 ans)');
    expect(ind.detail).toContain('retraite sans décote');
    expect(ind.detail).not.toMatch(/1 à 7 ans|selon l’ancienneté/);
    const postes = item(losses(fp), 'postes_publics');
    expect(postes.detail).toContain('fonctionnaire de l’État');
    expect(postes.detail).toContain(
      'une collectivité territoriale peut, par délibération, l’appliquer à ses fonctionnaires',
    );
    expect(postes.detail).not.toMatch(/ne vise pas les fonctionnaires territoriaux/);
    expect(postes.detail).not.toMatch(/1 à 7 ans/);
  });
  it('E2 / H11 (VERIFIED row 10): the foyer fiscal is maintained; only the amount is independent of marriage', () => {
    const h11 = compare(hh([salaried(), salaried(3000)])).activeHypotheses.find(
      (x) => x.id === 'H11',
    )!;
    expect(h11.value).toContain('le foyer fiscal est maintenu');
    expect(h11.value).toContain('le montant est le même marié·e ou non');
    expect(h11.value).not.toMatch(/individuel/);
  });
});

describe('Other plan-side changes of the Nov 2026 republication', () => {
  const all = (h: Household) => {
    const u = compare(h).unquantified;
    return [...u.promises, ...u.losses];
  };
  const item = (h: Household, id: string) => all(h).find((x) => x.id === id)!;

  it('tax counts: 54 State taxes (am. 22), 72 taxes affectées (am. 25), 21 social contributions (PLFSS 9), 20 local', () => {
    const p = item(cas('seul-1'), 'prix_taxes');
    expect(p.detail).toContain('54 taxes d’État, 72 taxes affectées');
    expect(p.detail).toContain('21 contributions sociales et 20 impositions locales');
    expect(p.detail).not.toMatch(/57 taxes|21 taxes d’État/);
    const labels = p.sources.map((s) => s.label).join(' | ');
    expect(labels).toContain('am. n° 22');
    expect(labels).toContain('am. n° 25');
    expect(labels).toContain('PLFSS 2027, am. n° 9');
  });
  it('electricity accise at 1 €/MWh for households from 1 Jul 2027 (am. 22 I bis), shown, not counted', () => {
    const a = item(cas('seul-1'), 'accise_electricite');
    expect(a.tier).toBe('law');
    expect(a.direction).toBe('promise');
    expect(a.detail).toContain('1er juillet 2027');
    expect(a.detail).toContain('1 € par mégawattheure pour les ménages');
  });
  it('PLFSS n° 9 gage: CSG on capital income raised, shown in the savings item', () => {
    const e = item(cas('seul-1'), 'epargne_exonerations');
    expect(e.detail).toContain('PLFSS n° 9');
    expect(e.detail).toContain('CSG sur les revenus du patrimoine et des placements');
  });
  it('PLF-P1 n° 29: twenty further local taxes abolished, compensated by the DGF', () => {
    const t = item(cas('retraite-1800'), 'taxe_fonciere');
    expect(t.detail).toContain('vingt autres impositions locales');
    expect(t.detail).toContain('dotation globale de fonctionnement');
  });
  it('PLF-P2 n° 34: no chèque énergie issued for 2027', () => {
    const t = item(cas('seul-0'), 'cheque_energie');
    expect(t.detail).toContain('aucun chèque n’est émis au titre de 2027');
  });
  it('version: engine 1.2.0 and a displayable plan-version label', () => {
    expect(ENGINE_VERSION).toBe('1.2.0');
    expect(PARAMS_META.engineVersion).toBe('1.2.0');
    expect(PARAMS_META.planVersionLabel).toBe('Amendements publiés le 18 novembre 2026');
    expect(PARAMS_META.planVersionDate).toBe('2026-11-18');
    expect(PARAMS_META.planSource).toContain('17 et 18 novembre 2026');
    expect(PARAMS_META.planSource).not.toContain('19 octobre');
  });
});
