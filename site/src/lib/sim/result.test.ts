import { describe, expect, it } from 'vitest';
import { compare } from '@/lib/engine';
import type { Comparison, Household } from '@/lib/engine-types';
import { defaultFormState, formToHousehold } from './form';
import {
  barBox,
  buildBridge,
  buildHeadline,
  displayFigures,
  headlineSentence,
  joinComponents,
  roundSumPreserving,
  zeroLeft,
} from './result';

const household = (
  patch: (f: ReturnType<typeof defaultFormState>) => void = () => {},
): Household => {
  const f = defaultFormState();
  patch(f);
  return formToHousehold(f).household!;
};

describe('roundSumPreserving', () => {
  it('rounded values add up to the rounded total', () => {
    const v = [12.4, 12.4, 12.4, 12.4, 12.4];
    const r = roundSumPreserving(v, 5);
    expect(r.every((x) => x % 5 === 0)).toBe(true);
    expect(r.reduce((a, b) => a + b, 0)).toBe(Math.round(62 / 5) * 5);
  });

  it('works with negative values and keeps zeros at zero', () => {
    const v = [-33.3, 41.2, 0, -7.9, 12.6];
    const r = roundSumPreserving(v, 5);
    expect(r[2]).toBe(0);
    const total = v.reduce((a, b) => a + b, 0);
    expect(r.reduce((a, b) => a + b, 0)).toBe(Math.round(total / 5) * 5);
  });

  it('is exact on multiples of the step', () => {
    expect(roundSumPreserving([10, -20, 30], 5)).toEqual([10, -20, 30]);
  });
});

describe('displayFigures — the numbers on screen agree', () => {
  const scenarios: Array<[string, Household]> = [
    ['default', household()],
    [
      'couple with two children, tenant',
      household((f) => {
        f.couple = true;
        f.children = [
          { id: 'a', age: 4, aeeh: false, cmi: false },
          { id: 'b', age: 11, aeeh: false, cmi: false },
        ];
      }),
    ],
    [
      'retiree',
      household((f) => {
        f.adults[0] = {
          ...f.adults[0],
          activity: 'retraite',
          pensionAmount: 1650,
          pensionStartYear: 2018,
        };
      }),
    ],
  ];

  it.each(scenarios)('%s: rows add up to totals, waterfall adds up to the headline', (_n, h) => {
    const c = compare(h);
    const fig = displayFigures(c);
    const sumBefore = fig.rows.reduce((s, r) => s + r.beforeShown, 0);
    const sumAfter = fig.rows.reduce((s, r) => s + r.afterShown, 0);
    expect(sumBefore).toBe(fig.baseline);
    expect(sumAfter).toBe(fig.plan);
    expect(fig.plan - fig.baseline).toBe(fig.delta);
    expect(fig.steps.reduce((s, v) => s + v, 0)).toBe(fig.delta);
    // headline = same number
    expect(buildHeadline(c).roundedDelta).toBe(fig.delta);
  });
});

describe('headline wording', () => {
  const fake = (delta: number, pct: number): Comparison =>
    ({
      delta,
      deltaPct: pct,
      deltaAfterTva: delta,
      baseline: {
        components: [
          {
            id: 'x',
            label: 'x',
            group: 'revenus',
            amount: 1000,
            formula: '',
            sources: [],
            tier: 'law',
          },
        ],
        disposable: 1000,
        perAdult: [],
      },
      plan: {
        components: [
          {
            id: 'x',
            label: 'x',
            group: 'revenus',
            amount: 1000 + delta,
            formula: '',
            sources: [],
            tier: 'law',
          },
        ],
        disposable: 1000 + delta,
        perAdult: [],
      },
      waterfall: [
        {
          id: 'x',
          label: 'x',
          delta,
          tier: 'law',
          sources: [],
          formulaBefore: '',
          formulaAfter: '',
        },
      ],
      unquantified: { promises: [], losses: [] },
      notModelled: [],
      activeHypotheses: [],
      warnings: [],
    }) as unknown as Comparison;

  it('uses a real minus sign and an explicit plus, rounded to 5 €', () => {
    expect(buildHeadline(fake(212, 0.2)).amount).toBe('+210 €/mois');
    expect(buildHeadline(fake(-87, -0.087)).amount).toBe('−85 €/mois');
    expect(buildHeadline(fake(-87, -0.087)).direction).toBe('loss');
  });

  it('says « pas de différence notable » under the rounding step', () => {
    const h = buildHeadline(fake(2, 0.002));
    expect(h.direction).toBe('flat');
    expect(headlineSentence(fake(2, 0.002), 'steady')).toMatch(/à peu près le même revenu/);
  });

  it('the sentence follows docs/VISION.md §1', () => {
    expect(headlineSentence(fake(212, 0.2), 'steady')).toBe(
      'Avec le plan complet appliqué à votre situation de 2026, votre ménage disposerait de +210 €/mois (+21 %).',
    );
    expect(headlineSentence(fake(-87, -0.087), 2028)).toMatch(
      /^En 2028, avec les mesures alors en vigueur/,
    );
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

describe('joinComponents', () => {
  it('drops lines that are 0 € on both sides and keeps group order', () => {
    const c = compare(household());
    const rows = joinComponents(c);
    expect(rows.every((r) => Math.abs(r.before) >= 0.5 || Math.abs(r.after) >= 0.5)).toBe(true);
    const order = ['revenus', 'prelevements', 'prestations', 'impots_indirects'];
    const idx = rows.map((r) => order.indexOf(r.group));
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  });
});
