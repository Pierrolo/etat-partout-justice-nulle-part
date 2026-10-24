import { useState } from 'react';
import { NumberInput, SegmentedControl, Term } from '@/components/ui';
import { employerView } from '@/lib/engine';
import type { SalaryStatus } from '@/lib/engine-types';
import { formatEuro, formatEuroDelta } from '@/lib/format';
import { plainText } from '@/lib/sim/result';

/**
 * « Et pour mes salariés ? » — one full-time employee, today vs the plan, from the employer's side
 * (engine `employerView`). Not the household's result: the employee's own household is another case.
 */
export function EmployerPanel({ owner }: { owner: boolean }) {
  const [amount, setAmount] = useState<number | null>(null);
  const [basis, setBasis] = useState<'net' | 'brut'>('net');
  const [status, setStatus] = useState<SalaryStatus>('prive');
  const v = amount !== null && amount > 0 ? employerView(amount, basis, status) : null;

  return (
    <section
      aria-labelledby="employer-title"
      data-testid="employer-panel"
      className="card space-y-5"
    >
      <header className="max-w-3xl space-y-1.5">
        <h4 id="employer-title" className="font-serif text-xl font-medium text-ink sm:text-2xl">
          Le plan pour un de vos salariés
        </h4>
        <p className="text-[0.9375rem] text-ink-2">
          {owner
            ? 'Vous dirigez une entreprise : voici ce que le plan change, pour vous comme employeur et pour un salarié à temps plein. '
            : 'Si vous employez du personnel : voici ce que le plan change pour un salarié à temps plein, et pour vous comme employeur. '}
          Indiquez sa paie : le calcul porte sur son salaire, pas sur la situation de son foyer.
        </p>
      </header>
      <div className="grid gap-5 sm:grid-cols-2">
        <SegmentedControl
          legend="Je donne son salaire…"
          size="sm"
          options={[
            { value: 'net', label: 'Net' },
            { value: 'brut', label: 'Brut' },
          ]}
          value={basis}
          onChange={setBasis}
        />
        <SegmentedControl
          legend="Statut du salarié"
          size="sm"
          options={[
            { value: 'prive', label: 'Non-cadre' },
            { value: 'cadre', label: 'Cadre' },
          ]}
          value={status === 'cadre' ? 'cadre' : 'prive'}
          onChange={setStatus}
        />
      </div>
      <NumberInput
        id="employee-pay"
        label={`Salaire mensuel ${basis === 'net' ? 'net' : 'brut'} d’un salarié à temps plein`}
        hint={
          basis === 'net'
            ? 'Net avant impôt, ce qui arrive sur son compte.'
            : 'Brut, en haut de la fiche de paie.'
        }
        unit="€/mois"
        value={amount}
        onChange={setAmount}
        min={0}
        max={100000}
        step={50}
        fieldClassName="w-full sm:w-72"
      />

      {v && v.supported ? (
        <div className="space-y-4" data-testid="employer-result">
          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-rule p-4">
              <dt className="text-sm text-ink-2">Son salaire net, par mois</dt>
              <dd className="num font-serif text-2xl font-medium text-ink">
                {formatEuro(v.today.employeeNet)} → {formatEuro(v.plan.employeeNet)}
              </dd>
              <dd className="num text-sm font-bold text-gain">
                {formatEuroDelta(v.employeeNetGain)} par mois, avant son impôt
              </dd>
            </div>
            <div className="rounded-lg border border-rule p-4">
              <dt className="text-sm text-ink-2">
                Votre <Term id="cout-employeur">coût employeur</Term>, par mois
              </dt>
              <dd className="num font-serif text-2xl font-medium text-ink">
                {formatEuro(v.today.employerCost)} → {formatEuro(v.plan.employerCost)}
              </dd>
              <dd className="text-sm font-bold text-ink-2">
                {v.employerCostChange === 0
                  ? 'Inchangé'
                  : `${formatEuroDelta(v.employerCostChange)} par mois`}
              </dd>
            </div>
            <div className="rounded-lg border border-rule p-4">
              <dt className="text-sm text-ink-2">
                <Term id="cotisations">Cotisations</Term> patronales, par mois
              </dt>
              <dd className="num font-serif text-2xl font-medium text-ink">
                {formatEuro(v.today.cotisationsPatronales)} →{' '}
                {formatEuro(v.plan.cotisationsPatronales)}
              </dd>
              <dd className="text-sm text-ink-2">
                Salaire brut : {formatEuro(v.today.gross)}, inchangé
              </dd>
            </div>
          </dl>
          <ul className="list-disc space-y-1.5 ps-5 text-sm text-ink-2 marker:text-ink-3">
            {v.notes.map((n) => (
              <li key={n}>{plainText(n)}</li>
            ))}
          </ul>
        </div>
      ) : v ? (
        <p className="text-[0.9375rem] text-ink-2">{v.notes.join(' ')}</p>
      ) : (
        <p className="rounded-md bg-sunken px-3.5 py-2.5 text-[0.9375rem] text-ink-2">
          Indiquez un salaire pour voir le calcul.
        </p>
      )}
    </section>
  );
}
