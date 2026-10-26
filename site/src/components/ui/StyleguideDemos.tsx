import { useState } from 'react';
import {
  NumberInput,
  SegmentedControl,
  StepIndicator,
  Stepper,
  Tabs,
  Callout,
} from '@/components/ui';
import { formatEuro } from '@/lib/format';

/** Interactive demos for /styleguide (one island so the page ships a single bundle). */
export function FormDemo() {
  const [income, setIncome] = useState<number | null>(1850);
  const [kids, setKids] = useState(2);
  const [status, setStatus] = useState<'seul' | 'couple'>('couple');
  const [activity, setActivity] = useState<'salarie' | 'chomage' | 'retraite' | 'etudiant'>(
    'salarie',
  );
  const [step, setStep] = useState(1);
  const steps = ['Foyer', 'Activité', 'Logement', 'Situation', 'Résultat'];

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="min-w-0 space-y-6">
        <NumberInput
          label="Salaire net mensuel"
          hint="Ce qui arrive sur votre compte, après prélèvements."
          unit="€/mois"
          value={income}
          onChange={setIncome}
          min={0}
          max={50000}
          step={50}
        />
        <p className="text-sm text-ink-3" aria-live="polite">
          Valeur lue :{' '}
          <span className="num font-semibold text-ink">
            {income === null ? '—' : formatEuro(income)}
          </span>
        </p>
        <Stepper
          label="Enfants à charge"
          value={kids}
          onChange={setKids}
          min={0}
          max={8}
          unit={['enfant', 'enfants']}
        />
      </div>
      <div className="min-w-0 space-y-6">
        <SegmentedControl
          legend="Votre foyer"
          options={[
            { value: 'seul', label: 'Seul·e' },
            { value: 'couple', label: 'En couple' },
          ]}
          value={status}
          onChange={setStatus}
        />
        <SegmentedControl
          legend="Votre activité"
          options={[
            { value: 'salarie', label: 'Salarié·e' },
            { value: 'chomage', label: 'Sans emploi' },
            { value: 'retraite', label: 'Retraité·e' },
            { value: 'etudiant', label: 'Étudiant·e' },
          ]}
          value={activity}
          onChange={setActivity}
        />
        <div className="space-y-3">
          <StepIndicator steps={steps} current={step} />
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              Précédent
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
            >
              Suivant
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TabsDemo() {
  return (
    <Tabs
      label="Affichage de l’exemple"
      tabs={[
        {
          id: 'graphique',
          label: 'Graphique',
          content: (
            <div className="hatch-fine flex h-40 items-center justify-center rounded-md border border-dashed border-rule-strong text-sm text-ink-3">
              (emplacement du graphique)
            </div>
          ),
        },
        {
          id: 'tableau',
          label: 'Tableau',
          content: (
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Foyer</th>
                  <th scope="col" data-numeric="">
                    Écart
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row" className="font-medium">
                    Exemple
                  </th>
                  <td data-numeric="">+212 €</td>
                </tr>
              </tbody>
            </table>
          ),
        },
        {
          id: 'sources',
          label: 'Sources',
          content: (
            <Callout tone="note">
              <p>Onglet Sources : origine, année, méthode de calcul et licence des données.</p>
            </Callout>
          ),
        },
      ]}
    />
  );
}
