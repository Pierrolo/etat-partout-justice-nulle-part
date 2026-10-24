/**
 * « Votre heure de travail » — for a salaried adult, where one hour of labour cost goes, today vs plan (steady).
 * The income tax is attributed to the adult pro rata of their salary in the foyer's taxable income (baseline) or
 * as 23 % of their own salary base (plan, before the AFU, which is a per-person transfer shown separately).
 * TVA is attributed at the household's average TVA / disposable-income ratio.
 */
import { abattementSalaire } from './baseline/ir.ts';
import { r2 } from './fmt.ts';
import { n } from './params/index.ts';
import { evaluate } from './simulate.ts';
import type { Household, Hypotheses } from './types.ts';

export interface HourSplit {
  employerCostPerHour: number;
  cotisationsPatronales: number;
  cotisationsSalariales: number;
  csgCrds: number;
  impotRevenu: number;
  tva: number;
  youKeep: number;
}

export function hourOfWork(
  h: Household,
  adultIndex = 0,
  opts: { hypotheses?: Partial<Hypotheses> } = {},
): { hoursPerMonth: number; baseline: HourSplit; plan: HourSplit } {
  const e = evaluate(h, opts.hypotheses ? { hypotheses: opts.hypotheses } : {});
  const zero: HourSplit = {
    employerCostPerHour: 0,
    cotisationsPatronales: 0,
    cotisationsSalariales: 0,
    csgCrds: 0,
    impotRevenu: 0,
    tva: 0,
    youKeep: 0,
  };
  const a = e.nh.adults[adultIndex];
  if (!a || !a.salary) return { hoursPerMonth: 0, baseline: zero, plan: { ...zero } };
  const hours = n('general.legal_monthly_hours') * a.salary.workRatio;

  const split = (scenario: 'baseline' | 'plan'): HourSplit => {
    const core = scenario === 'baseline' ? e.baselineCore : e.planCore!;
    const res = scenario === 'baseline' ? e.baseline : e.plan!;
    const s = core.flows.sal[adultIndex]!;
    const salTaxY = 12 * s.taxable;
    let irMonthly = 0;
    if (core.tax.regime === 'bareme') {
      const fo = core.tax.foyers.find((x) => x.foyer.adults.includes(adultIndex));
      if (fo && fo.rnc > 0)
        irMonthly = (fo.irAfterDecote * ((salTaxY - abattementSalaire(salTaxY)) / fo.rnc)) / 12;
    } else {
      const base = salTaxY - (core.rules.year.fraisPro ? abattementSalaire(salTaxY) : 0);
      irMonthly = (n('plan.flat_rate') * base) / 12;
    }
    const tvaTotal = -res.components
      .filter((c) => c.group === 'impots_indirects')
      .reduce((x, c) => x + c.amount, 0);
    const tvaRate = res.disposable > 0 ? tvaTotal / res.disposable : 0;
    const tvaMonthly = Math.max(0, tvaRate * Math.max(0, s.net - irMonthly));
    const per = (x: number) => r2(x / hours);
    const out = {
      employerCostPerHour: per(s.employerCost),
      cotisationsPatronales: per(s.cotisationsPatronales),
      cotisationsSalariales: per(s.cotisationsSalariales),
      csgCrds: per(s.csgDed + s.csgNonDed + s.crds),
      impotRevenu: per(irMonthly),
      tva: per(tvaMonthly),
      youKeep: 0,
    };
    out.youKeep = r2(
      out.employerCostPerHour -
        out.cotisationsPatronales -
        out.cotisationsSalariales -
        out.csgCrds -
        out.impotRevenu -
        out.tva,
    );
    return out;
  };
  return { hoursPerMonth: r2(hours), baseline: split('baseline'), plan: split('plan') };
}
