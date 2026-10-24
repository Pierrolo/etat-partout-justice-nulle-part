/**
 * v1.1 « Et pour mes salariés ? » — one employee's pay today vs the plan (steady state), from the employer's side.
 * Gross pay is the anchor (H4): the CSG/CRDS on earned income disappears, so the employee's net rises by
 * 9,7 % × 98,25 % of gross; employer contributions are unchanged (the RGDU is kept, PLFSS am. 1 II 3°) so the
 * employer cost is unchanged. The taxe sur les salaires the plan abolishes is only paid by employers not subject
 * to VAT (associations, banks, insurers, health care): not modelled here.
 */
import { CSG_NONE, grossFromNet, salaryChain } from './baseline/salaire.ts';
import { r2 } from './fmt.ts';
import type { SalaryStatus } from './types.ts';

export interface EmployerSide {
  gross: number;
  /** employee's net pay (before income tax) */
  employeeNet: number;
  employerCost: number;
  cotisationsPatronales: number;
  cotisationsSalariales: number;
  csgCrds: number;
}

export interface EmployerView {
  status: SalaryStatus;
  /** false for 'tns' (not modelled): every amount is 0 and `notes` says why */
  supported: boolean;
  today: EmployerSide;
  plan: EmployerSide;
  /** plan.employeeNet − today.employeeNet, €/month */
  employeeNetGain: number;
  /** plan.employerCost − today.employerCost, €/month (0 in steady state) */
  employerCostChange: number;
  /** plain French notes for the UI */
  notes: string[];
}

const ZERO: EmployerSide = {
  gross: 0,
  employeeNet: 0,
  employerCost: 0,
  cotisationsPatronales: 0,
  cotisationsSalariales: 0,
  csgCrds: 0,
};

/**
 * @param amount monthly pay of one full-time employee
 * @param basis 'net' (net pay before income tax, as on the payslip) or 'brut'
 * @param status the employee's status ('prive', 'cadre', 'fonctionnaire', 'dirigeant_assimile'; 'tns' is refused)
 */
export function employerView(
  amount: number,
  basis: 'net' | 'brut',
  status: SalaryStatus,
): EmployerView {
  if (status === 'tns' || !(amount > 0) || !Number.isFinite(amount)) {
    return {
      status,
      supported: false,
      today: { ...ZERO },
      plan: { ...ZERO },
      employeeNetGain: 0,
      employerCostChange: 0,
      notes: [
        status === 'tns'
          ? 'Travailleur non salarié (gérant majoritaire, indépendant) : ce régime n’est pas modélisé.'
          : 'Montant de salaire manquant ou invalide.',
      ],
    };
  }
  const gross = basis === 'brut' ? amount : grossFromNet(amount, status);
  const side = (planned: boolean): EmployerSide => {
    const s = salaryChain(gross, status, 1, planned ? CSG_NONE : undefined);
    return {
      gross: r2(s.gross),
      employeeNet: r2(s.net),
      employerCost: r2(s.employerCost),
      cotisationsPatronales: r2(s.cotisationsPatronales),
      cotisationsSalariales: r2(s.cotisationsSalariales),
      csgCrds: r2(s.csgDed + s.csgNonDed + s.crds),
    };
  };
  const today = side(false);
  const plan = side(true);
  const notes = [
    'Le salaire brut est supposé inchangé (hypothèse H4) : la suppression de la CSG et de la CRDS sur les salaires augmente le salaire net du montant de ces prélèvements.',
    'Coût employeur inchangé une fois le plan complet appliqué : le plan ne modifie pas les cotisations patronales et garde la réduction générale des cotisations (amendement PLFSS n° 1, II 3°).',
    'La taxe sur les salaires, supprimée par le plan, ne concerne que les employeurs qui ne paient pas la TVA (associations, banques, assurances, professions de santé) : non modélisée ici.',
    'Le salarié paiera en revanche l’impôt à 23 % et recevra l’aide fondamentale : son revenu disponible dépend de son foyer (utilisez le simulateur pour lui).',
  ];
  if (status === 'fonctionnaire')
    notes.push('Fonction publique : cotisations approchées (voir la méthode).');
  if (status === 'dirigeant_assimile')
    notes.push(
      'Dirigeant assimilé salarié : pas d’assurance chômage ni de réduction générale des cotisations.',
    );
  return {
    status,
    supported: true,
    today,
    plan,
    employeeNetGain: r2(plan.employeeNet - today.employeeNet),
    employerCostChange: r2(plan.employerCost - today.employerCost),
    notes,
  };
}
