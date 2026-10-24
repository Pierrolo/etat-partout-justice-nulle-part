import type { ReactNode } from 'react';
import { NumberInput, SegmentedControl, Term } from '@/components/ui';
import type { Activity, Disability, SalaryStatus } from '@/lib/engine-types';
import { LIMITS, type FieldErrors, type FormAdult } from '@/lib/sim/form';

const ACTIVITIES: Array<{ value: Activity; label: string }> = [
  { value: 'salarie', label: 'En emploi' },
  { value: 'chomage', label: 'Sans emploi' },
  { value: 'retraite', label: 'À la retraite' },
  { value: 'etudiant', label: 'En études' },
  { value: 'inactif', label: 'Autre situation, sans revenu' },
];

const STATUSES: Array<{ value: SalaryStatus; label: string }> = [
  { value: 'prive', label: 'Salarié du privé, non-cadre' },
  { value: 'cadre', label: 'Salarié du privé, cadre' },
  { value: 'fonctionnaire', label: 'Fonctionnaire (école, hôpital, mairie…)' },
  { value: 'dirigeant_assimile', label: 'Dirigeant·e de SAS/SARL (assimilé salarié)' },
  { value: 'tns', label: 'Indépendant / gérant majoritaire (TNS)' },
];

const DISABILITIES: Array<{ value: Disability; label: string }> = [
  { value: 'none', label: 'Non' },
  { value: 'aah_80', label: 'Oui, taux de 80 % ou plus' },
  { value: 'aah_50_79', label: 'Oui, taux de 50 à 79 %' },
];

export interface AdultFieldsProps {
  index: 0 | 1;
  /** The first adult is « vous »; the second is « votre conjoint·e » (labels read « Son âge », « Son salaire »). */
  you: boolean;
  value: FormAdult;
  onChange: (patch: Partial<FormAdult>) => void;
  errors: FieldErrors;
  /** Show every error now (after a « Suivant » / « Voir mon résultat » attempt). */
  validate: boolean;
  idPrefix: string;
}

/** Everything we ask about ONE adult. Fields appear only when the activity needs them. */
export function AdultFields({
  index,
  you,
  value: a,
  onChange,
  errors,
  validate,
  idPrefix,
}: AdultFieldsProps) {
  const k = `adult${index}`;
  const seg = (key: string) => (validate ? errors[`${k}.${key}`] : undefined);

  return (
    <div className="space-y-6">
      <div data-field={`${k}.age`}>
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
          validate={validate}
          fieldClassName="w-48 max-w-full"
          hint={
            you
              ? 'Certaines aides dépendent de l’âge (le RSA, par exemple, à partir de 25 ans).'
              : undefined
          }
        />
      </div>

      <div data-field={`${k}.activity`}>
        <SegmentedControl
          legend={you ? 'Aujourd’hui, vous êtes…' : 'Aujourd’hui, cette personne est…'}
          options={ACTIVITIES}
          value={a.activity}
          onChange={(activity) => onChange({ activity })}
          error={seg('activity')}
        />
      </div>

      {a.activity === 'salarie' && (
        <div className="space-y-6">
          <div data-field={`${k}.status`}>
            <SegmentedControl
              legend={you ? 'Votre statut' : 'Son statut'}
              layout="stack"
              hint={
                <>
                  Les cotisations ne sont pas les mêmes selon le statut. Si vous dirigez une
                  entreprise et recevez une fiche de paie (président·e de SAS, gérant·e minoritaire
                  de SARL), choisissez « dirigeant·e »{', '}
                  <Term id="dirigeant-assimile">assimilé salarié</Term>. Gérant majoritaire,
                  indépendant et micro-entrepreneur (<Term id="tns">TNS</Term>) : pas encore pris en
                  compte.
                </>
              }
              options={STATUSES}
              value={a.salaryStatus}
              onChange={(salaryStatus) => onChange({ salaryStatus })}
              error={seg('status')}
            />
          </div>

          {a.salaryStatus === 'tns' && (
            <p
              role="note"
              className="rounded-md border-s-4 border-ink-3 bg-sunken px-4 py-3 text-[0.9375rem] text-ink"
            >
              <strong>Pas encore couvert.</strong> Le revenu d’un indépendant ou d’un gérant
              majoritaire (cotisations aux indépendants, bénéfices, micro-entreprise) n’est pas
              modélisé : nous ne vous montrerons pas de chiffre qui ne serait pas le vôtre. Si vous
              êtes en réalité président·e de SAS ou gérant·e minoritaire de SARL, choisissez
              « dirigeant·e ».
            </p>
          )}

          {a.salaryStatus !== null && a.salaryStatus !== 'tns' && (
            <>
              <SegmentedControl
                legend={you ? 'Je donne mon salaire…' : 'Je donne son salaire…'}
                options={[
                  { value: 'net', label: 'Net (ce que je touche)' },
                  { value: 'brut', label: 'Brut (en haut de la fiche de paie)' },
                ]}
                value={a.salaryBasis}
                onChange={(salaryBasis) => onChange({ salaryBasis })}
              />
              <div data-field={`${k}.salary`}>
                <NumberInput
                  id={`${idPrefix}-salary`}
                  label={`${you ? 'Votre salaire' : 'Son salaire'} mensuel ${a.salaryBasis === 'net' ? 'net' : 'brut'}`}
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
                  validate={validate}
                  fieldClassName="w-full sm:w-72"
                />
              </div>
            </>
          )}
        </div>
      )}

      {a.activity === 'chomage' && (
        <div className="space-y-6">
          <div data-field={`${k}.are`}>
            <SegmentedControl
              legend={
                you
                  ? 'Touchez-vous une allocation chômage ?'
                  : 'Cette personne touche-t-elle une allocation chômage ?'
              }
              hint={
                <>
                  L’allocation d’aide au retour à l’emploi (<Term id="are">ARE</Term>), versée par
                  France Travail.
                </>
              }
              options={[
                { value: 'oui', label: 'Oui' },
                { value: 'non', label: 'Non' },
              ]}
              value={a.areOn === null ? null : a.areOn ? 'oui' : 'non'}
              onChange={(v) => onChange({ areOn: v === 'oui' })}
              error={a.areOn === null ? seg('are') : undefined}
            />
          </div>
          {a.areOn === true && (
            <NumberInput
              id={`${idPrefix}-are`}
              label="Montant de l’allocation chaque mois"
              hint="Le montant net versé chaque mois par France Travail."
              unit="€/mois"
              value={a.areMonthly}
              onChange={(areMonthly) => onChange({ areMonthly })}
              min={0}
              max={LIMITS.areMax}
              step={50}
              error={errors[`${k}.are`]}
              validate={validate}
              fieldClassName="w-full sm:w-72"
            />
          )}
        </div>
      )}

      {a.activity === 'retraite' && (
        <div className="space-y-6">
          <SegmentedControl
            legend={you ? 'Je donne ma pension…' : 'Je donne sa pension…'}
            options={[
              { value: 'net', label: 'Nette (ce que je touche)' },
              { value: 'brut', label: 'Brute' },
            ]}
            value={a.pensionBasis}
            onChange={(pensionBasis) => onChange({ pensionBasis })}
          />
          <div data-field={`${k}.pension`}>
            <NumberInput
              id={`${idPrefix}-pension`}
              label={`${you ? 'Votre pension' : 'Sa pension'} mensuelle ${a.pensionBasis === 'net' ? 'nette' : 'brute'}`}
              hint="Retraite de base et retraite complémentaire réunies."
              unit="€/mois"
              value={a.pensionAmount}
              onChange={(pensionAmount) => onChange({ pensionAmount })}
              min={0}
              max={LIMITS.pensionMax}
              step={50}
              error={errors[`${k}.pension`]}
              validate={validate}
              fieldClassName="w-full sm:w-72"
            />
          </div>
        </div>
      )}

      {(a.activity === 'etudiant' || a.activity === 'inactif') && (
        <Hint>
          Aucun revenu à indiquer pour {you ? 'vous' : 'cette personne'}. Les aides sont calculées à
          partir de la situation du foyer.
        </Hint>
      )}

      <SegmentedControl
        legend={
          you ? 'Avez-vous un handicap reconnu ?' : 'Cette personne a-t-elle un handicap reconnu ?'
        }
        hint={
          <>
            Allocation aux adultes handicapés (<Term id="aah">AAH</Term>). À partir d’un taux de 80
            %, la carte mobilité inclusion « invalidité » (<Term id="cmi">CMI</Term>) ouvre un
            supplément prévu par le plan ; pas en dessous.
          </>
        }
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
