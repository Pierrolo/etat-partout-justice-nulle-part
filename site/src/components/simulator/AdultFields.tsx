import type { ReactNode } from 'react';
import { NumberInput, SegmentedControl } from '@/components/ui';
import type { Activity, Disability, SalaryStatus } from '@/lib/engine-types';
import { LIMITS, type FieldErrors, type FormAdult } from '@/lib/sim/form';

const ACTIVITIES: Array<{ value: Activity; label: string }> = [
  { value: 'salarie', label: 'Salarié·e' },
  { value: 'chomage', label: 'Sans emploi' },
  { value: 'retraite', label: 'Retraité·e' },
  { value: 'etudiant', label: 'Étudiant·e' },
  { value: 'inactif', label: 'Inactif·ve' },
];

const STATUSES: Array<{ value: SalaryStatus; label: string }> = [
  { value: 'prive', label: 'Privé, non-cadre' },
  { value: 'cadre', label: 'Cadre' },
  { value: 'fonctionnaire', label: 'Fonctionnaire' },
];

const DISABILITIES: Array<{ value: Disability; label: string }> = [
  { value: 'none', label: 'Aucune' },
  { value: 'aah_80', label: 'AAH, taux de 80 % ou plus' },
  { value: 'aah_50_79', label: 'AAH, taux de 50 à 79 %' },
];

export interface AdultFieldsProps {
  index: 0 | 1;
  /** « Vous » or « Votre conjoint·e » — used in labels read by screen readers. */
  who: 'vous' | 'conjoint';
  value: FormAdult;
  onChange: (patch: Partial<FormAdult>) => void;
  errors: FieldErrors;
  idPrefix: string;
}

/** Everything we ask about ONE adult. Fields appear only when the activity needs them. */
export function AdultFields({
  index,
  who,
  value: a,
  onChange,
  errors,
  idPrefix,
}: AdultFieldsProps) {
  const k = `adult${index}`;
  const you = who === 'vous';
  const subject = you ? 'Vous êtes' : 'Cette personne est';
  const act = (v: Activity) => onChange({ activity: v });

  return (
    <div className="space-y-6">
      <NumberInput
        id={`${idPrefix}-age`}
        label={you ? 'Votre âge' : 'Son âge'}
        unit="ans"
        value={a.age}
        onChange={(age) => onChange({ age })}
        min={LIMITS.adultAge.min}
        max={LIMITS.adultAge.max}
        step={1}
        error={errors[`${k}.age`]}
        fieldClassName="w-48 max-w-full"
        hint={
          index === 0
            ? 'Certaines aides dépendent de l’âge (RSA à partir de 25 ans, par exemple).'
            : undefined
        }
      />

      <SegmentedControl
        legend={`${subject}…`}
        options={ACTIVITIES}
        value={a.activity}
        onChange={act}
      />

      {a.activity === 'salarie' && (
        <div className="space-y-6">
          <SegmentedControl
            legend="Je saisis mon salaire…"
            options={[
              { value: 'net', label: 'Net (ce que je touche)' },
              { value: 'brut', label: 'Brut (fiche de paie)' },
            ]}
            value={a.salaryBasis}
            onChange={(salaryBasis) => onChange({ salaryBasis })}
          />
          <NumberInput
            id={`${idPrefix}-salary`}
            label={`Salaire mensuel ${a.salaryBasis === 'net' ? 'net' : 'brut'}`}
            hint={
              a.salaryBasis === 'net'
                ? 'Ce qui arrive sur le compte chaque mois, avant l’impôt prélevé à la source.'
                : 'Avant cotisations et CSG, en haut de la fiche de paie.'
            }
            unit="€/mois"
            value={a.salaryAmount}
            onChange={(salaryAmount) => onChange({ salaryAmount })}
            min={0}
            max={LIMITS.salaryMax}
            step={50}
            error={errors[`${k}.salary`]}
            fieldClassName="w-full sm:w-72"
          />
          <SegmentedControl
            legend="Statut"
            hint="Les cotisations ne sont pas les mêmes : pour un même net, le brut change."
            options={STATUSES}
            value={a.salaryStatus}
            onChange={(salaryStatus) => onChange({ salaryStatus })}
          />
        </div>
      )}

      {a.activity === 'chomage' && (
        <div className="space-y-6">
          <SegmentedControl
            legend="Indemnisation"
            options={[
              { value: 'oui', label: 'Indemnisé·e (ARE)' },
              { value: 'non', label: 'Non indemnisé·e' },
            ]}
            value={a.areOn ? 'oui' : 'non'}
            onChange={(v) => onChange({ areOn: v === 'oui' })}
          />
          {a.areOn && (
            <NumberInput
              id={`${idPrefix}-are`}
              label="Allocation chômage mensuelle (ARE)"
              hint="Le montant versé chaque mois par France Travail."
              unit="€/mois"
              value={a.areMonthly}
              onChange={(areMonthly) => onChange({ areMonthly })}
              min={0}
              max={LIMITS.areMax}
              step={50}
              error={errors[`${k}.are`]}
              fieldClassName="w-full sm:w-72"
            />
          )}
        </div>
      )}

      {a.activity === 'retraite' && (
        <div className="space-y-6">
          <SegmentedControl
            legend="Je saisis ma pension…"
            options={[
              { value: 'net', label: 'Nette (ce que je touche)' },
              { value: 'brut', label: 'Brute' },
            ]}
            value={a.pensionBasis}
            onChange={(pensionBasis) => onChange({ pensionBasis })}
          />
          <NumberInput
            id={`${idPrefix}-pension`}
            label={`Pension mensuelle ${a.pensionBasis === 'net' ? 'nette' : 'brute'}`}
            hint="Retraite de base et complémentaire réunies."
            unit="€/mois"
            value={a.pensionAmount}
            onChange={(pensionAmount) => onChange({ pensionAmount })}
            min={0}
            max={LIMITS.pensionMax}
            step={50}
            error={errors[`${k}.pension`]}
            fieldClassName="w-full sm:w-72"
          />
          <NumberInput
            id={`${idPrefix}-pension-year`}
            label="Année de départ à la retraite"
            hint="Le plan traite différemment les retraites liquidées avant le 1er janvier 2028."
            value={a.pensionStartYear}
            onChange={(pensionStartYear) => onChange({ pensionStartYear })}
            min={LIMITS.pensionYear.min}
            max={LIMITS.pensionYear.max}
            step={1}
            error={errors[`${k}.pensionYear`]}
            fieldClassName="w-48 max-w-full"
          />
        </div>
      )}

      {(a.activity === 'etudiant' || a.activity === 'inactif') && (
        <Hint>
          Aucun revenu à saisir pour {you ? 'vous' : 'cette personne'}. Les aides sont calculées à
          partir de la situation du foyer.
        </Hint>
      )}

      <SegmentedControl
        legend="Situation de handicap"
        hint="Un taux de 80 % ou plus donne droit à la carte mobilité inclusion « invalidité » : le plan prévoit alors un supplément, et seulement dans ce cas."
        options={DISABILITIES}
        value={a.disability}
        onChange={(disability) => onChange({ disability })}
      />
    </div>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="rounded-md bg-sunken px-3 py-2 text-sm text-ink-2">{children}</p>;
}
