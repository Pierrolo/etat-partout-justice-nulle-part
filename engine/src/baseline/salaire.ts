/**
 * Salary chain gross → net and employer cost (baseline-rules.md §3), per status.
 * - prive : exact port of scripts/baseline_reference.py `salary_chain` (non-cadre, < 11 employees, AT/MP 2,08 %).
 * - cadre : + APEC (0,024 % employee / 0,036 % employer on 0..4 PMSS). Prévoyance cadre (1,50 % employer) is
 *   not modelled (like every mutuelle/prévoyance line).
 * - fonctionnaire : APPROXIMATION (titulaire, CNRACL-like): gross = traitement indiciaire + primes (primes share
 *   20 %, hypothesis); employee: retenue pension 11,10 % on the traitement + RAFP 5 % on primes (capped at 20 %
 *   of the traitement); employer: pension 37,65 % + maladie 9,88 % on the traitement, AF 5,25 %, CSA+FNAL 0,4 %,
 *   RAFP 5 %. No RGDU, no chômage. CSG/CRDS identical to the private sector.
 * - dirigeant_assimile (v1.1): président·e de SAS/SASU, gérant·e minoritaire de SARL — like a cadre, without the
 *   employer's assurance chômage and AGS contributions and without the RGDU (reserved for pay subject to
 *   unemployment insurance). 'tns' never reaches this chain (not modelled, see normalize).
 * The CSG/CRDS rates on earned income are an input (`rates`) so the plan can switch them off (or phase them out).
 */
import { n } from '../params/index.ts';
import type { SalaryStatus } from '../types.ts';

export interface CsgRates {
  /** total CSG rate on earned income (9,2 % today) */
  csg: number;
  /** deductible part (6,8 % today) */
  csgDed: number;
  /** CRDS (0,5 % today) */
  crds: number;
}

export const CSG_TODAY: CsgRates = {
  csg: n('salary.csg_crds.csg_total'),
  csgDed: n('salary.csg_crds.csg_deductible'),
  crds: n('salary.csg_crds.crds'),
};
export const CSG_NONE: CsgRates = { csg: 0, csgDed: 0, crds: 0 };

export interface SalaryResult {
  status: SalaryStatus;
  gross: number;
  workRatio: number;
  cotisationsSalariales: number;
  csgBase: number;
  csgDed: number;
  csgNonDed: number;
  crds: number;
  /** net à payer avant impôt (= base RSA/PA) */
  net: number;
  /** net imposable (before the 10 % deduction) */
  taxable: number;
  employerBeforeReduction: number;
  rgdu: number;
  /** employer contributions net of RGDU */
  cotisationsPatronales: number;
  /** super-brut / coût employeur */
  employerCost: number;
}

function privateChain(B: number, workRatio: number, cadre: boolean, dirigeant = false) {
  const P = n('general.pmss_monthly');
  const t1 = Math.min(B, P);
  const t2 = Math.max(0, Math.min(B, 8 * P) - P);
  const b4 = Math.min(B, 4 * P);
  let cot =
    n('salary.employee.vieillesse_plafonnee') * t1 +
    n('salary.employee.vieillesse_deplafonnee') * B +
    n('salary.employee.agirc_arrco_t1') * t1 +
    n('salary.employee.agirc_arrco_t2') * t2 +
    n('salary.employee.ceg_t1') * t1 +
    n('salary.employee.ceg_t2') * t2 +
    (B > P ? n('salary.employee.cet') * Math.min(B, 8 * P) : 0);
  if (cadre) cot += n('salary.employee.apec_cadre') * b4;

  let employer =
    n('salary.employer.maladie') * B +
    n('salary.employer.vieillesse_plafonnee') * t1 +
    n('salary.employer.vieillesse_deplafonnee') * B +
    n('salary.employer.allocations_familiales') * B +
    n('salary.employer.at_mp_default') * B +
    n('salary.employer.fnal_lt50') * t1 +
    n('salary.employer.csa') * B +
    (dirigeant ? 0 : n('salary.employer.assurance_chomage') * b4 + n('salary.employer.ags') * b4) +
    n('salary.employer.agirc_arrco_t1') * t1 +
    n('salary.employer.agirc_arrco_t2') * t2 +
    n('salary.employer.ceg_t1') * t1 +
    n('salary.employer.ceg_t2') * t2 +
    (B > P ? n('salary.employer.cet') * Math.min(B, 8 * P) : 0) +
    n('salary.employer.formation_lt11') * B +
    n('salary.employer.taxe_apprentissage') * B +
    n('salary.employer.contribution_dialogue_social') * B;
  if (cadre) employer += n('x.apec_employer') * b4;

  // RGDU (réduction générale dégressive unique), SMIC reference frozen at 12,02 €/h for 2026
  const smicRef =
    workRatio * n('salary.rgdu.smic_reference_hourly') * n('general.legal_monthly_hours');
  const tMin = n('salary.rgdu.t_min');
  const tDelta = n('salary.rgdu.t_delta_lt50');
  let coef = 0;
  // the RGDU only applies to pay subject to unemployment insurance: never to an assimilé-salarié director
  if (!dirigeant && B > 0 && B < n('salary.rgdu.exit_threshold_in_smic') * smicRef) {
    const x = Math.max(0, 0.5 * ((3 * smicRef) / B - 1));
    coef = tMin + Math.round(tDelta * x ** n('salary.rgdu.power') * 1e4) / 1e4;
    coef = Math.min(coef, tMin + tDelta);
  }
  return { cot, employer, rgdu: coef * B };
}

function fonctionnaireChain(B: number) {
  const primes = n('x.fp.primes_share') * B;
  const tib = B - primes;
  const rafpBase = Math.min(primes, n('x.fp.rafp_cap_share_of_tib') * tib);
  const cot = n('x.fp.retenue_pension') * tib + n('x.fp.rafp') * rafpBase;
  const employer =
    (n('x.fp.employer_pension') + n('x.fp.employer_maladie')) * tib +
    (n('x.fp.employer_af') + n('x.fp.employer_csa_fnal')) * B +
    n('x.fp.rafp') * rafpBase;
  return { cot, employer, rgdu: 0 };
}

export function salaryChain(
  gross: number,
  status: SalaryStatus,
  workRatio: number,
  rates: CsgRates = CSG_TODAY,
): SalaryResult {
  const B = Math.max(0, gross);
  const P = n('general.pmss_monthly');
  const { cot, employer, rgdu } =
    status === 'fonctionnaire'
      ? fonctionnaireChain(B)
      : privateChain(
          B,
          workRatio,
          status === 'cadre' || status === 'dirigeant_assimile',
          status === 'dirigeant_assimile',
        );
  const csgBase =
    n('salary.csg_crds.base_abattement_factor') * Math.min(B, 4 * P) + Math.max(0, B - 4 * P);
  const csgDed = rates.csgDed * csgBase;
  const csgNonDed = (rates.csg - rates.csgDed) * csgBase;
  const crds = rates.crds * csgBase;
  return {
    status,
    gross: B,
    workRatio,
    cotisationsSalariales: cot,
    csgBase,
    csgDed,
    csgNonDed,
    crds,
    net: B - cot - csgDed - csgNonDed - crds,
    taxable: B - cot - csgDed,
    employerBeforeReduction: employer,
    rgdu,
    cotisationsPatronales: employer - rgdu,
    employerCost: B + employer - rgdu,
  };
}

/** Net → gross (bisection; net is strictly increasing in gross for every status). */
export function grossFromNet(
  net: number,
  status: SalaryStatus,
  rates: CsgRates = CSG_TODAY,
): number {
  if (!(net > 0)) return 0;
  let lo = net;
  let hi = net * 1.6 + 100;
  while (salaryChain(hi, status, 1, rates).net < net) hi *= 1.5;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (salaryChain(mid, status, 1, rates).net < net) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-7) break;
  }
  return (lo + hi) / 2;
}
