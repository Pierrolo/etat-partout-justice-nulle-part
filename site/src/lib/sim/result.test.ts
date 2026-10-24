import { describe, expect, it } from 'vitest';
import { CAS_TYPES, compare, decodeState, encodeState, roundForDisplay } from '@/lib/engine';
import type { Household, SourceRef } from '@/lib/engine-types';
import { emptyAdult, emptyFormState, formToHousehold, householdToForm } from './form';
import {
  announcement,
  barBox,
  buildBridge,
  buildHeadline,
  certaintyParts,
  headlinePct,
  headlineSentence,
  niceTicks,
  plainText,
  pctText,
  prominentLosses,
  shownSteps,
  uniqueSources,
  zeroLeft,
} from './result';

const household = (patch: (f: ReturnType<typeof emptyFormState>) => void = () => {}): Household => {
  const f = emptyFormState();
  f.couple = false;
  f.adults[0] = emptyAdult({
    age: 35,
    activity: 'salarie',
    salaryAmount: 1478,
    salaryStatus: 'prive',
  });
  f.housing = { status: 'locataire', rentMonthly: 600, zone: 2 };
  patch(f);
  return formToHousehold(f).household!;
};

const scenarios: Array<[string, Household]> = [
  ['single at the SMIC', household()],
  [
    'couple, two children, tenant',
    household((f) => {
      f.couple = true;
      f.marriedOrPacs = true;
      f.adults[1] = emptyAdult({
        age: 38,
        activity: 'salarie',
        salaryAmount: 2200,
        salaryStatus: 'cadre',
      });
      f.children = [
        { id: 'a', age: 4, aeeh: false, cmi: false },
        { id: 'b', age: 11, aeeh: false, cmi: false },
      ];
    }),
  ],
  [
    'retiree',
    household((f) => {
      f.adults[0] = emptyAdult({ age: 74, activity: 'retraite', pensionAmount: 980 });
      f.housing = { status: 'proprietaire', rentMonthly: null, zone: null };
    }),
  ],
  [
    'assistante maternelle, cost left blank',
    household((f) => {
      f.children = [{ id: 'a', age: 2, aeeh: false, cmi: false }];
      f.childSupport = { received: false, monthly: null };
      f.extras.childcare = 'assistante_maternelle';
    }),
  ],
];

describe('the numbers on screen agree (engine roundForDisplay)', () => {
  it.each(scenarios)('%s: the headline, the steps and the totals are the same figures', (_n, h) => {
    const c = compare(h);
    const d = roundForDisplay(c);
    const head = buildHeadline(c, d);
    expect(head.delta).toBe(d.deltaAfterTva);
    expect(head.plan - head.baseline).toBe(head.delta);
    const steps = shownSteps(c, d);
    expect(steps.reduce((s, x) => s + x.shown, 0)).toBe(d.deltaAfterTva);
    // the engine's own sentence carries the same figure when it mentions the price rise
    const m = /l’écart serait de ([+−])([\d  ]+) €/.exec(c.summary.sentence);
    if (m) {
      const v = Number(m[2]!.replace(/\D/g, '')) * (m[1] === '−' ? -1 : 1);
      expect(v).toBe(d.deltaAfterTva);
    }
  });

  it('every standard case: the sentence and the displayed headline never disagree', () => {
    for (const cas of CAS_TYPES) {
      const c = compare(cas.household);
      const d = roundForDisplay(c);
      const m = /l’écart serait de ([+−])([\d  ]+) €/.exec(c.summary.sentence);
      if (m) {
        const v = Number(m[2]!.replace(/\D/g, '')) * (m[1] === '−' ? -1 : 1);
        expect(v, cas.id).toBe(d.deltaAfterTva);
      }
    }
  });
});

describe('percentages', () => {
  it('shows « — », never « 0,0 % », when the engine says a percentage is meaningless', () => {
    const jeune = CAS_TYPES.find((c) => c.id === 'jeune-22-inactif')!;
    const c = compare(jeune.household);
    expect(c.deltaPct).toBeNull();
    expect(headlinePct(c)).toBeNull();
    expect(pctText(headlinePct(c))).toBe('—');
    expect(buildHeadline(c, roundForDisplay(c)).percent).toBe('—');
    expect(headlineSentence(c, roundForDisplay(c), 'steady')).not.toMatch(/0,0/);
  });

  it('is measured on the same basis as the headline figures (after TVA)', () => {
    const c = compare(scenarios[1]![1]);
    const d = roundForDisplay(c);
    const pct = headlinePct(c)!;
    expect(pct).toBeCloseTo(c.deltaAfterTva / c.baseline.disposableAfterTva, 10);
    // a reader dividing the two figures on screen finds the displayed percentage (± rounding of the figures)
    expect(Math.abs(pct - d.deltaAfterTva / d.baselineAfterTva)).toBeLessThan(0.01);
  });
});

describe('headline wording', () => {
  it('uses a real minus sign, an explicit plus and says what it is after', () => {
    const c = compare(household());
    const d = roundForDisplay(c);
    const h = buildHeadline(c, d);
    expect(h.amount).toMatch(/^[+−]\d+(?: \d{3})* €\/mois$/);
    expect(h.basis).toBe('après impôts, aides et TVA estimée');
    expect(headlineSentence(c, d, 'steady')).toMatch(
      /^Avec le plan complet appliqué à votre situation de 2026, votre ménage aurait .* (de plus|de moins) par mois/,
    );
    expect(headlineSentence(c, d, 2028)).toMatch(/^En 2028, avec les mesures alors en vigueur/);
  });

  it('announces the figure in one short sentence', () => {
    const c = compare(household());
    expect(announcement(c, roundForDisplay(c))).toMatch(/^Résultat mis à jour[\s\u202F]?: ?[+−]\d/);
  });
});

describe('the engine summary, prominent losses and benefits are there to be shown', () => {
  it('summary: sentence, gains, losses, why and certainty, split for display', () => {
    const c = compare(scenarios[1]![1]);
    expect(c.summary.sentence.length).toBeGreaterThan(20);
    expect(c.summary.gains.length).toBeGreaterThan(0);
    expect(c.summary.why.length).toBeGreaterThan(10);
    const parts = certaintyParts(c.summary.certainty);
    expect(parts.intro).toMatch(/Aujourd’hui/);
    expect(parts.items.length).toBeGreaterThanOrEqual(2);
  });

  it('a fonctionnaire has a prominent loss (posts), a retiree one on indexation', () => {
    const fonct = compare(
      household((f) => {
        f.adults[0] = { ...f.adults[0]!, salaryStatus: 'fonctionnaire' };
      }),
    );
    expect(prominentLosses(fonct).map((i) => i.id)).toContain('postes_publics');
    const retiree = compare(scenarios[2]![1]);
    expect(prominentLosses(retiree).map((i) => i.id)).toContain('gel_indexation');
  });

  it('twelve benefits, and a reason for each one at 0 €', () => {
    const c = compare(scenarios[1]![1]);
    expect(c.baselineBenefitsExplained).toHaveLength(12);
    for (const b of c.baselineBenefitsExplained) {
      if (b.amount === 0) expect(b.reason, b.id).toBeTruthy();
    }
  });
});

describe('h1Alternative is there when the two readings differ', () => {
  it('an AAH 50–79 % adult without income: both readings, far apart', () => {
    const h = household((f) => {
      f.adults[0] = emptyAdult({ age: 40, activity: 'inactif', disability: 'aah_50_79' });
    });
    const c = compare(h);
    expect(c.h1Alternative).toBeDefined();
    expect(c.h1Alternative!.hypothesis).toBe('differential');
    expect(Math.abs(c.h1Alternative!.deltaAfterTva - c.deltaAfterTva)).toBeGreaterThan(5);
  });
});

describe('text hygiene', () => {
  it('never shows a developer path', () => {
    expect(plainText('Hypothèse du simulateur (voir docs/METHODE.md)')).not.toMatch(/docs\//);
    expect(plainText('voir docs/METHODE.md#h1')).toBe('(voir la page Méthode)');
  });

  it('deduplicates sources, including a compound label made of already-seen parts', () => {
    const sources: SourceRef[] = [
      { label: 'Liasse PLF 2027, am. n° 28' },
      { label: 'loi n° 2026-103, art. 4' },
      { label: 'BOFiP actualité du 07/04/2026' },
      { label: 'loi n° 2026-103, art. 4 ; BOFiP actualité du 07/04/2026' },
      { label: 'Liasse PLF 2027, am. n° 28' },
    ];
    expect(uniqueSources(sources).map((s) => s.label)).toEqual([
      'Liasse PLF 2027, am. n° 28',
      'loi n° 2026-103, art. 4',
      'BOFiP actualité du 07/04/2026',
    ]);
  });

  it('the waterfall of a real result has no duplicate source label per line', () => {
    const c = compare(scenarios[1]![1]);
    for (const s of shownSteps(c, roundForDisplay(c))) {
      const labels = s.sources.map((x) => x.label);
      expect(new Set(labels).size, s.id).toBe(labels.length);
    }
  });
});

describe('shared links go through form validation, and rebuild the same household', () => {
  it('every standard case survives hash → form → household with the same result', () => {
    for (const cas of CAS_TYPES) {
      const decoded = decodeState(
        encodeState(
          cas.household,
          { H1_benefits: 'replaced', H2_fraisPro10: true, H5_tvaPassThrough: 1, includeTva: true },
          'steady',
        ),
      )!;
      const check = formToHousehold(householdToForm(decoded.household));
      expect(check.errors, cas.id).toEqual({});
      expect(compare(check.household!).deltaAfterTva, cas.id).toBeCloseTo(
        compare(cas.household).deltaAfterTva,
        6,
      );
    }
  });

  it('a decoded household with an impossible age is rejected by the form, not computed', () => {
    const h = household();
    h.adults[0] = { ...h.adults[0]!, age: 400 };
    const decoded = decodeState(
      encodeState(
        h,
        { H1_benefits: 'replaced', H2_fraisPro10: true, H5_tvaPassThrough: 1, includeTva: true },
        'steady',
      ),
    );
    if (decoded) expect(formToHousehold(householdToForm(decoded.household)).household).toBeNull();
  });
});

describe('waterfall geometry', () => {
  it('bridges cumulate from 0 and the boxes stay inside the track', () => {
    const steps = [
      {
        id: 'salaire_net' as const,
        label: 'a',
        delta: 180,
        tier: 'law' as const,
        sources: [],
        formulaBefore: '',
        formulaAfter: '',
      },
      {
        id: 'impot_revenu' as const,
        label: 'b',
        delta: -345,
        tier: 'law' as const,
        sources: [],
        formulaBefore: '',
        formulaAfter: '',
      },
      {
        id: 'afu' as const,
        label: 'c',
        delta: 550,
        tier: 'announced' as const,
        sources: [],
        formulaBefore: '',
        formulaAfter: '',
      },
    ];
    const b = buildBridge(steps);
    expect(b.total).toBe(385);
    expect(b.min).toBe(-165);
    expect(b.max).toBe(385);
    for (const r of b.rows) {
      const { left, width } = barBox(b, r.from, r.to);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left + width).toBeLessThanOrEqual(100.001);
    }
    expect(zeroLeft(b)).toBeGreaterThan(0);
    expect(zeroLeft(b)).toBeLessThan(100);
  });
});

describe('niceTicks', () => {
  it('gives round steps inside the range', () => {
    expect(niceTicks(-165, 385, 4)).toEqual([-100, 0, 100, 200, 300]);
    expect(niceTicks(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(niceTicks(0, 0, 4)).toEqual([0]);
    for (const t of niceTicks(-1234, 987, 6)) {
      expect(t).toBeGreaterThanOrEqual(-1234);
      expect(t).toBeLessThanOrEqual(987);
    }
  });
});
