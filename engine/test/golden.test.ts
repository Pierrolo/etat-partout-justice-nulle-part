/**
 * Invariant 3: the baseline reproduces research/baseline/golden-cases.json (OpenFisca-France 176.1.3 oracle),
 * component by component, within the tolerances of baseline-rules.md §12 / parameters.json › test_tolerances
 * (the same table as scripts/baseline_reference.py --check). Two documented exceptions (7 €/month):
 * edge_af_degressif (AF, oracle N-2 base) and sp2_1_5smic (PA, APL revalorised within the last 3 months).
 */
import { describe, expect, it } from 'vitest';
import { evaluate } from '../src/simulate.ts';
import { GOLDEN, toHousehold } from './helpers/golden.ts';

const TOL = {
  salary: 0.08,
  rgdu: 0.4,
  pension: 0.05,
  benefit: 0.6,
  ars: 1,
  rni: 7,
  ir: 3,
  disposable: 8,
  known: 7,
};
const KNOWN = new Set(['edge_af_degressif|af_gross', 'sp2_1_5smic|ppa_gross']);

describe('golden cases (OpenFisca oracle)', () => {
  it('has 40 cases', () => expect(GOLDEN.length).toBe(40));

  for (const c of GOLDEN) {
    it(`${c.id} — ${c.label}`, () => {
      const e = evaluate(toHousehold(c), {}, false);
      const f = e.baselineCore.flows;
      const o = c.outputs;
      const rows: Array<[string, number, number, number]> = [];
      const s0 = f.sal.find((s) => s !== null);
      const oa = o.adults[0]!;
      if (s0) {
        rows.push(['net_pay_before_tax', s0.net, oa.net_pay_before_tax as number, TOL.salary]);
        rows.push(['net_taxable', s0.taxable, oa.net_taxable as number, TOL.salary]);
        rows.push([
          'employer_contributions_before_rgdu',
          s0.employerBeforeReduction,
          oa.employer_contributions_before_rgdu as number,
          TOL.salary,
        ]);
        rows.push(['rgdu_reduction', s0.rgdu, oa.rgdu_reduction as number, TOL.rgdu]);
        rows.push([
          'super_gross_total_labour_cost',
          s0.employerCost,
          oa.super_gross_total_labour_cost as number,
          TOL.rgdu,
        ]);
      }
      const retirees = o.adults.filter((a) => a.status === 'retraite');
      f.pens
        .filter((p) => p !== null)
        .forEach((p, k) =>
          rows.push([
            'pension_net',
            p!.net,
            retirees[k]!.pension_net_before_tax as number,
            TOL.pension,
          ]),
        );
      const hm = o.household_monthly;
      const ben: Array<[string, number, number]> = [
        ['ppa_gross', f.pa, hm.ppa_gross!],
        ['rsa', f.rsa, hm.rsa!],
        ['housing_benefit_gross', f.aplGross, hm.housing_benefit_gross!],
        ['af_gross', f.af, hm.af_gross!],
        ['cf_gross', f.cf, hm.cf_gross!],
        ['paje_gross', f.paje, hm.paje_base_gross!],
        ['aspa', f.aspa, hm.aspa!],
        ['aah', f.aah.reduce((s, x) => s + x, 0), hm.aah!],
      ];
      for (const [k, mine, theirs] of ben)
        rows.push([k, mine, theirs, KNOWN.has(`${c.id}|${k}`) ? TOL.known : TOL.benefit]);
      rows.push(['asf_net', f.asf * 0.995, hm.asf_net_of_crds!, TOL.benefit]);
      rows.push(['ars_gross_august', f.arsAnnual, o.benefits_annual.ars_gross_august!, TOL.ars]);
      const t = e.baselineCore.tax;
      rows.push([
        'rni',
        t.foyers.reduce((s, x) => s + x.rni, 0),
        o.tax_annual.net_taxable_income_rni!,
        TOL.rni,
      ]);
      rows.push(['parts', t.foyers[0]!.parts, o.tax_annual.parts!, 0.001]);
      rows.push([
        'ir_net_signed_abs',
        Math.abs(t.irGross - t.credits),
        Math.abs(o.tax_annual.ir_signed_economic!),
        TOL.ir,
      ]);
      rows.push([
        'disposable_monthly',
        e.baseline.disposable,
        o.disposable_income_monthly_steady_state,
        TOL.disposable,
      ]);
      const bad = rows
        .filter(([, mine, theirs, tol]) => !(Math.abs(mine - theirs) <= tol))
        .map(([k, m, t2, tol]) => `${k}: engine ${m.toFixed(2)} vs oracle ${t2} (tol ${tol})`);
      expect(bad).toEqual([]);
    });
  }
});
