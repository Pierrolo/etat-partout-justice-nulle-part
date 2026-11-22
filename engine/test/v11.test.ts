/** engine 1.1 — « after user testing » (docs/ENGINE-API.md, section v1.1). One block per item. */
import { describe, expect, it } from 'vitest';
import {
  CAS_TYPES,
  compare,
  decodeState,
  DEFAULT_HYPOTHESES,
  employerView,
  encodeState,
  hourOfWork,
  roundForDisplay,
  roundSumPreserving,
  simulate,
  type Comparison,
  type Household,
} from '../src/index.ts';
import { salaryChain } from '../src/baseline/salaire.ts';

const amt = (r: { components: Array<{ id: string; amount: number }> }, id: string) =>
  r.components.find((c) => c.id === id)!.amount;
const cas = (id: string) => CAS_TYPES.find((c) => c.id === id)!.household;
const CRDS = 0.005;
/** French formatting uses no-break spaces; compare with plain spaces */
const sp = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');

/** Thomas: married couple 4 800 + 2 300 € net, children 7 and 3, owner with a loan. */
const thomas = (extras: Household['extras'] = {}): Household => ({
  adults: [
    {
      age: 38,
      activity: 'salarie',
      disability: 'none',
      salary: { amount: 4800, basis: 'net', status: 'cadre' },
    },
    {
      age: 36,
      activity: 'salarie',
      disability: 'none',
      salary: { amount: 2300, basis: 'net', status: 'prive' },
    },
  ],
  marriedOrPacs: true,
  children: [{ age: 7 }, { age: 3 }],
  housing: { status: 'proprietaire_credit' },
  benefits: { nonRecours: false },
  extras,
});

/** A modest couple, one child of 2: the CMG is large. */
const modest = (extras: Household['extras']): Household => ({
  adults: [
    {
      age: 30,
      activity: 'salarie',
      disability: 'none',
      salary: { amount: 1500, basis: 'net', status: 'prive' },
    },
    {
      age: 30,
      activity: 'salarie',
      disability: 'none',
      salary: { amount: 1500, basis: 'net', status: 'prive' },
    },
  ],
  marriedOrPacs: true,
  children: [{ age: 2 }],
  housing: { status: 'locataire', rentMonthly: 700, zone: 2 },
  benefits: { nonRecours: false },
  extras,
});

describe('1. childcare: CMG and crédit d’impôt garde d’enfants', () => {
  it('CMG « emploi direct » = cost × (1 − R × taux d’effort / 4,85), net of CRDS; removed by the plan', () => {
    const h = thomas({ childcare: 'assistante_maternelle', childcareCostMonthly: 873 });
    const c = compare(h);
    const R = c.baseline.taxableIncomeAnnual / 12; // RNC of the foyer (married couple)
    const expected = 873 * (1 - (R * 0.000516) / 4.85) * (1 - CRDS);
    expect(amt(c.baseline, 'cmg')).toBeCloseTo(expected, 1);
    expect(amt(c.baseline, 'cmg')).toBeGreaterThan(200);
    expect(amt(c.plan, 'cmg')).toBe(0);
    expect(c.waterfall.find((w) => w.id === 'cmg')!.delta).toBeCloseTo(-expected, 1);
    // Thomas saw no change when ticking the mode: now he does
    const none = compare(thomas());
    expect(c.delta).toBeLessThan(none.delta - 200);
  });

  it('missing cost ⇒ documented default (180 h × 4,85 €) + warning; explicit cost ⇒ no warning', () => {
    const def = compare(thomas({ childcare: 'assistante_maternelle' }));
    const given = compare(
      thomas({ childcare: 'assistante_maternelle', childcareCostMonthly: 873 }),
    );
    expect(def.delta).toBeCloseTo(given.delta, 2);
    expect(
      def.warnings.some((w) => sp(w).startsWith('Frais de garde non renseignés : 873,00 €')),
    ).toBe(true);
    expect(given.warnings.some((w) => w.startsWith('Frais de garde non renseignés'))).toBe(false);
    expect(def.activeHypotheses.find((x) => x.id === 'H20')!.value).toContain('non renseignés');
  });

  it('crédit d’impôt: 50 % of the cost net of the CMG (cap 3 500 €/child); −1/3 in 2027, −2/3 in 2028, 0 after', () => {
    const h = modest({ childcare: 'assistante_maternelle', childcareCostMonthly: 900 });
    const b = compare(h);
    const cmgGross = amt(b.baseline, 'cmg') / (1 - CRDS);
    const credit = (0.5 * Math.min(12 * (900 - cmgGross), 3500)) / 12;
    // the couple pays no income tax, the credit is refundable
    expect(amt(b.baseline, 'credits_impot')).toBeCloseTo(credit, 1);
    expect(amt(b.plan, 'credits_impot')).toBe(0);
    const y27 = compare(h, { period: 2027 });
    expect(amt(y27.plan, 'cmg')).toBeCloseTo(amt(b.baseline, 'cmg'), 2); // CMG paid until 31 Dec 2027
    expect(amt(y27.plan, 'credits_impot')).toBeCloseTo((2 / 3) * credit, 1);
    const y28 = compare(h, { period: 2028 });
    expect(amt(y28.plan, 'cmg')).toBe(0);
    // CMG gone: the credit base is the full cost, at 1/3
    expect(amt(y28.plan, 'credits_impot')).toBeCloseTo((0.5 * 3500 * (1 / 3)) / 12, 1);
  });

  it('micro-crèche: CMG « structure » by tier, halved from 3 to 6, ≤ 85 % of the bill', () => {
    const h = modest({ childcare: 'micro_creche', childcareCostMonthly: 1500 });
    const c = compare(h);
    // RNC ≈ 2 × 16 600 = 33 k€ > 24 333 € ⇒ tier 2 (couple, 1 child): 855,25 €
    expect(amt(c.baseline, 'cmg')).toBeCloseTo(855.25 * (1 - CRDS), 2);
    const older = compare({ ...h, children: [{ age: 4 }] });
    expect(amt(older.baseline, 'cmg')).toBeCloseTo(427.63 * (1 - CRDS), 2);
    const cheap = compare({
      ...h,
      extras: { childcare: 'micro_creche', childcareCostMonthly: 500 },
    });
    expect(amt(cheap.baseline, 'cmg')).toBeCloseTo(0.85 * 500 * (1 - CRDS), 2);
    expect(amt(c.plan, 'cmg')).toBe(0);
  });

  it('crèche PSU: no CMG, explained, loss kept unquantified and prominent', () => {
    const c = compare(modest({ childcare: 'creche', childcareCostMonthly: 300 }));
    expect(amt(c.baseline, 'cmg')).toBe(0);
    const ex = c.baselineBenefitsExplained.find((b) => b.id === 'cmg')!;
    expect(ex.reason).toContain('crèche municipale ou associative');
    const loss = c.unquantified.losses.find((l) => l.id === 'creche_cmg')!;
    expect(loss.prominent).toBe(true);
    expect(loss.detail).toContain('prestation de service unique');
  });

  it('activity condition and income: reasons come from the rule that zeroed the CMG', () => {
    const inactive = modest({ childcare: 'assistante_maternelle', childcareCostMonthly: 800 });
    inactive.adults[1] = { age: 30, activity: 'inactif', disability: 'none' };
    const a = compare(inactive);
    expect(amt(a.baseline, 'cmg')).toBe(0);
    expect(a.baselineBenefitsExplained.find((b) => b.id === 'cmg')!.reason).toContain(
      'chaque parent doit travailler',
    );
    // one child: taux d'effort 0,0619 % × resources capped at 8 500 € = 5,26 € > 4,85 € ⇒ CMG = 0
    const rich = modest({ childcare: 'assistante_maternelle', childcareCostMonthly: 900 });
    rich.adults[0]!.salary!.amount = 7000;
    rich.adults[1]!.salary!.amount = 7000;
    const r = compare(rich);
    expect(amt(r.baseline, 'cmg')).toBe(0);
    expect(r.baselineBenefitsExplained.find((b) => b.id === 'cmg')!.reason).toContain(
      'trop élevés',
    );
  });
});

describe('2. ASF and child support', () => {
  const lone = (cs?: number): Household => {
    const h = structuredClone(cas('mono-1-1e'));
    if (cs !== undefined) h.benefits.childSupportReceivedMonthly = cs;
    return h;
  };
  it('ASF is differential: full without child support, reduced, then nil at or above its amount', () => {
    const full = amt(simulate(lone(), 'baseline'), 'asf');
    expect(full).toBeGreaterThan(190);
    expect(amt(simulate(lone(100), 'baseline'), 'asf')).toBeCloseTo(full - 100 * (1 - CRDS), 2);
    expect(amt(simulate(lone(250), 'baseline'), 'asf')).toBe(0);
    const c = compare(lone(250));
    expect(c.baselineBenefitsExplained.find((b) => b.id === 'asf')!.reason).toContain(
      'pension alimentaire',
    );
  });
  it('hypothesis H19 lists the default (not received) so the UI can show it', () => {
    const h19 = compare(lone()).activeHypotheses.find((x) => x.id === 'H19')!;
    expect(h19.value).toContain('non déclarée');
    expect(compare(cas('seul-1')).activeHypotheses.some((x) => x.id === 'H19')).toBe(false);
  });
});

const ACRONYMS = ['AFU', 'RSA', 'APL', 'CMG', 'AAH', 'ASPA', 'PAJE', 'AEEH', 'CSG', 'CRDS', 'TVA'];
/** every acronym is preceded (in the same text) by an opening parenthesis: « … (aide fondamentale universelle, AFU) » */
const expanded = (s: string) =>
  ACRONYMS.every((a) => !new RegExp(`\\b${a}\\b`).test(s) || /\(/.test(s.split(a)[0]!));

describe('3. plain-language summary', () => {
  it('top 3 gains / losses by absolute amount, plain labels, driver and certainty', () => {
    for (const ct of CAS_TYPES) {
      const c = compare(ct.household);
      const s = c.summary;
      expect(s.gains.length).toBeLessThanOrEqual(3);
      expect(s.losses.length).toBeLessThanOrEqual(3);
      expect(s.gains.every((g) => g.amount > 0)).toBe(true);
      expect(s.losses.every((g) => g.amount < 0)).toBe(true);
      const absG = s.gains.map((g) => g.amount);
      expect([...absG].sort((a, b) => b - a)).toEqual(absG);
      const maxGain = Math.max(0, ...c.waterfall.map((w) => w.delta));
      if (maxGain > 0) expect(s.gains[0]!.amount).toBe(maxGain);
      for (const l of [...s.gains, ...s.losses]) expect(expanded(l.label)).toBe(true);
      expect(s.sentence).toMatch(/par mois/);
      expect(s.why.length).toBeGreaterThan(10);
      expect(s.certainty).toContain('loi en vigueur');
    }
  });
  it('a SMIC earner: the gain comes from the universal aid, which compensates the higher tax', () => {
    const s0 = compare(cas('seul-1')).summary;
    const s = { ...s0, sentence: sp(s0.sentence), why: sp(s0.why) };
    expect(s.sentence).toContain('environ 155 € de plus par mois');
    expect(s.why).toMatch(/^Votre gain vient surtout de l’aide universelle de 550 € par adulte/);
    expect(s.why).toContain('la hausse de votre impôt sur le revenu');
    expect(s.certainty).toContain('écrit dans les amendements proposés (pas encore votés)');
    expect(s.certainty).toContain('annoncé, sans texte de loi');
  });
  it('a loser: « votre perte vient surtout de … »', () => {
    expect(compare(cas('aah50-seul')).summary.why).toMatch(
      /^Votre perte vient surtout de la fin de/,
    );
  });
});

describe('4. today’s benefits explained', () => {
  it('every benefit at 0 € has a reason, none otherwise', () => {
    for (const ct of CAS_TYPES) {
      const c = compare(ct.household);
      expect(c.baselineBenefitsExplained.length).toBe(12);
      for (const b of c.baselineBenefitsExplained) {
        expect(b.amount).toBe(amt(c.baseline, b.id));
        if (b.amount === 0) expect(b.reason && b.reason.length > 5).toBe(true);
        else expect(b.reason).toBeUndefined();
      }
    }
  });
  it('reasons follow the rule: AF from the 2nd child, APL income ceiling vs owner', () => {
    const one = compare(cas('mono-1-1e')).baselineBenefitsExplained;
    expect(one.find((b) => b.id === 'allocations_familiales')!.reason).toBe(
      'versées à partir du 2e enfant de moins de 20 ans',
    );
    const rich = compare(cas('seul-3')).baselineBenefitsExplained.find(
      (b) => b.id === 'aides_logement',
    )!;
    expect(rich.amount).toBe(0);
    const h = cas('seul-3');
    expect(rich.reason).toContain(
      h.housing.status === 'locataire' ? 'dépassent le plafond pour votre loyer' : 'locataires',
    );
    const nr = compare({ ...cas('seul-0'), benefits: { nonRecours: true } });
    expect(nr.baselineBenefitsExplained.find((b) => b.id === 'rsa')!.reason).toContain(
      'ne pas toucher',
    );
  });
});

describe('5. hour of work including the AFU', () => {
  it('afuPerHour = own AFU / hours; net tax = 23 % share − AFU; youKeep + AFU', () => {
    const r = hourOfWork(cas('seul-1'));
    expect(r.baseline.afuPerHour).toBe(0);
    expect(r.baseline.youKeepIncludingTransfers).toBe(r.baseline.youKeep);
    expect(r.plan.afuPerHour).toBeCloseTo(550 / r.hoursPerMonth, 2);
    expect(r.plan.netIncomeTaxPerHour).toBeCloseTo(r.plan.impotRevenu - r.plan.afuPerHour, 2);
    expect(r.plan.netIncomeTaxPerHour).toBeLessThan(0); // at the SMIC the State pays per hour
    expect(r.plan.youKeepIncludingTransfers).toBeCloseTo(r.plan.youKeep + r.plan.afuPerHour, 2);
    expect(r.plan.youKeepIncludingTransfers).toBeGreaterThan(r.baseline.youKeepIncludingTransfers);
  });
  it('the children’s AFU is not attributed to the worker', () => {
    const r = hourOfWork(cas('mono-1-2e'));
    expect(r.plan.afuPerHour).toBeCloseTo(550 / r.hoursPerMonth, 2);
  });
});

describe('6. H1: both readings', () => {
  it('present when the readings differ by > 5 €, with the other reading’s figures', () => {
    const c = compare(cas('seul-0'));
    expect(c.h1Alternative).toBeDefined();
    expect(c.h1Alternative!.hypothesis).toBe('differential');
    const d = compare(cas('seul-0'), { hypotheses: { H1_benefits: 'differential' } });
    expect(c.h1Alternative!.delta).toBe(d.delta);
    expect(c.h1Alternative!.deltaAfterTva).toBe(d.deltaAfterTva);
    expect(d.h1Alternative!.hypothesis).toBe('replaced');
    expect(d.h1Alternative!.delta).toBe(c.delta);
  });
  it('absent when H1 does not matter', () => {
    expect(compare(cas('seul-5')).h1Alternative).toBeUndefined();
  });
});

describe('7. deltaPct', () => {
  it('null when today’s disposable income is ≤ 50 €/month', () => {
    const c = compare(cas('jeune-22-inactif'));
    expect(c.baseline.disposable).toBe(0);
    expect(c.deltaPct).toBeNull();
    expect(compare(cas('seul-1')).deltaPct).toBeCloseTo(
      compare(cas('seul-1')).delta / compare(cas('seul-1')).baseline.disposable,
      10,
    );
  });
});

describe('8. business owners and employees', () => {
  it('dirigeant assimilé salarié: cadre without unemployment insurance nor RGDU; same net', () => {
    const gross = 8000; // above the RGDU exit (3 SMIC): only the unemployment contributions differ
    const d = salaryChain(gross, 'dirigeant_assimile', 1);
    const k = salaryChain(gross, 'cadre', 1);
    expect(d.net).toBeCloseTo(k.net, 6);
    expect(k.employerCost - d.employerCost).toBeCloseTo((0.04 + 0.0025) * gross, 1);
    const smic = salaryChain(1867.02, 'dirigeant_assimile', 1);
    expect(smic.rgdu).toBe(0);
    const c = compare({
      ...cas('seul-1'),
      adults: [
        {
          age: 45,
          activity: 'salarie',
          disability: 'none',
          salary: { amount: 3000, basis: 'net', status: 'dirigeant_assimile' },
        },
      ],
    });
    expect(c.unsupported).toBeUndefined();
    expect(c.notModelled.some((x) => x.startsWith('Dirigeant·e assimilé·e'))).toBe(true);
  });
  it('TNS: not modelled — income ignored, warning and `unsupported`', () => {
    const c = compare({
      ...cas('seul-1'),
      adults: [
        {
          age: 45,
          activity: 'salarie',
          disability: 'none',
          salary: { amount: 3000, basis: 'net', status: 'tns' },
        },
      ],
    });
    expect(c.unsupported).toHaveLength(1);
    expect(c.warnings.some((w) => w.includes('non salarié'))).toBe(true);
    expect(amt(c.baseline, 'salaire_net')).toBe(0);
  });
  it('employerView: CSG removal raises the net, employer cost unchanged', () => {
    const v = employerView(1900, 'net', 'prive');
    expect(v.supported).toBe(true);
    expect(v.today.employeeNet).toBeCloseTo(1900, 2);
    expect(v.employeeNetGain).toBeCloseTo(v.today.csgCrds, 2);
    expect(v.employerCostChange).toBe(0);
    expect(v.notes.join(' ')).toContain('taxe sur les salaires');
    expect(employerView(2400.21, 'brut', 'prive').today.employeeNet).toBeCloseTo(1900, 1);
    expect(employerView(1900, 'net', 'tns').supported).toBe(false);
  });
});

describe('9. roundForDisplay', () => {
  it('largest remainder to 5 €: lines add up to the shown totals, headline = round(delta)', () => {
    const all: Comparison[] = [];
    for (const ct of CAS_TYPES) {
      all.push(compare(ct.household));
      all.push(compare(ct.household, { period: 2028 }));
      all.push(compare(ct.household, { hypotheses: { includeTva: false } }));
    }
    for (const c of all) {
      const d = roundForDisplay(c);
      const m5 = (x: number) => Math.abs(x % 5) < 1e-9;
      const nonInd = d.lines.filter((l) => l.group !== 'impots_indirects');
      const ind = d.lines.filter((l) => l.group === 'impots_indirects');
      expect(d.delta).toBe(Math.round(c.delta / 5) * 5 || 0);
      expect(d.plan).toBe(d.baseline + d.delta);
      expect(nonInd.reduce((s, l) => s + l.before, 0)).toBe(d.baseline);
      expect(nonInd.reduce((s, l) => s + l.after, 0)).toBe(d.plan);
      expect(d.baselineAfterTva).toBe(d.baseline + ind.reduce((s, l) => s + l.before, 0));
      expect(d.planAfterTva).toBe(d.plan + ind.reduce((s, l) => s + l.after, 0));
      const wf = d.waterfall.filter((w) => w.id !== 'tva' && w.id !== 'cee');
      expect(wf.reduce((s, w) => s + w.delta, 0)).toBe(d.delta);
      for (const l of d.lines) expect(m5(l.before) && m5(l.after) && m5(l.delta)).toBe(true);
    }
  });
  it('roundSumPreserving keeps the rounded sum', () => {
    expect(roundSumPreserving([2.6, 2.6, 2.6], 5)).toEqual([5, 5, 0]);
    expect(roundSumPreserving([2.6, 2.6, 2.6], 5).reduce((s, x) => s + x, 0)).toBe(10);
    expect(roundSumPreserving([-7.4, 3.3, 948.2], 5).reduce((s, x) => s + x, 0)).toBe(945);
  });
});

describe('10. unquantified losses: plainTitle and prominence', () => {
  it('every item has a plain title and a prominence flag', () => {
    for (const ct of CAS_TYPES) {
      const u = compare(ct.household).unquantified;
      for (const it of [...u.promises, ...u.losses]) {
        expect(typeof it.plainTitle).toBe('string');
        expect(it.plainTitle!.length).toBeLessThanOrEqual(90);
        expect(typeof it.prominent).toBe('boolean');
      }
    }
  });
  it('flags what can exceed ~50 €/month for this household', () => {
    const loss = (h: Household, id: string) =>
      compare(h).unquantified.losses.find((l) => l.id === id);
    expect(loss(cas('chomeur-are'), 'chomage_6_mois')!.prominent).toBe(true);
    expect(loss(cas('seul-1'), 'chomage_6_mois')!.prominent).toBe(false);
    expect(loss(cas('aah50-seul'), 'reste_a_charge_10')!.prominent).toBe(true);
    const retiree = CAS_TYPES.find((c) =>
      c.household.adults.some((a) => a.activity === 'retraite'),
    )!.household;
    expect(loss(retiree, 'gel_indexation')!.prominent).toBe(true);
    const fp = structuredClone(cas('seul-1'));
    fp.adults[0]!.salary!.status = 'fonctionnaire';
    const postes = loss(fp, 'postes_publics')!;
    expect(postes.prominent).toBe(true);
    expect(postes.title).toContain('580 000');
    expect(postes.title).toContain('70 %');
  });
});

describe('URL state v1.1', () => {
  it('round-trips the new fields; 1.0 households keep a 3-slot benefits array', () => {
    const h = modest({ childcare: 'micro_creche', childcareCostMonthly: 1400 });
    h.benefits.childSupportReceivedMonthly = 180;
    h.adults[0]!.salary!.status = 'dirigeant_assimile';
    h.adults[1]!.salary!.status = 'tns';
    const s = encodeState(h, DEFAULT_HYPOTHESES, 'steady');
    expect(decodeState(s)!.household).toEqual(h);
    const old = encodeState(cas('seul-1'), DEFAULT_HYPOTHESES, 'steady');
    const json = JSON.parse(
      Buffer.from(old.slice(3).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(),
    );
    expect(json[1][4]).toHaveLength(3);
  });
});
