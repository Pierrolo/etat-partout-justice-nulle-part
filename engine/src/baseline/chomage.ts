/**
 * Allocation d'aide au retour à l'emploi (ARE) — NOT in the baseline research; engine approximation.
 * The user types the NET monthly ARE received. CSG 6,2 % (3,8 % deductible) + CRDS 0,5 % on 98,25 % of the gross
 * ARE, « écrêtées » so that they never bring the allocation below the gross monthly SMIC (simplification of the
 * daily SMIC rule). The 3 % retirement contribution on the reference wage and the duration of rights are not
 * modelled. The ARE is taxable as a « traitement et salaire » (10 % deduction) and counts as a resource
 * (not as earned income) for RSA / prime d'activité.
 */
import { n } from '../params/index.ts';

export interface AreResult {
  gross: number;
  csg: number;
  csgDed: number;
  crds: number;
  net: number;
  taxable: number;
}

function rate(): number {
  return (n('x.are.csg_rate') + n('x.are.crds')) * n('salary.csg_crds.base_abattement_factor');
}

export function areFromNet(net: number): AreResult {
  const v = Math.max(0, net);
  const floor = n('general.smic_monthly_gross_35h');
  const c = rate();
  // below the floor nothing is withheld; above, either the full rate or the écrêtement keeps net ≥ floor
  const gross = v <= floor ? v : v / (1 - c);
  const contrib = v <= floor ? 0 : gross - v;
  const share = contrib > 0 ? contrib / (gross * c) : 0;
  const base = n('salary.csg_crds.base_abattement_factor') * gross;
  const csg = share * n('x.are.csg_rate') * base;
  const csgDed = share * n('x.are.csg_deductible') * base;
  const crds = share * n('x.are.crds') * base;
  return { gross, csg, csgDed, crds, net: v, taxable: gross - csgDed };
}
