import { useEffect, useRef, type ReactNode } from 'react';
import {
  Button,
  Checkbox,
  Disclosure,
  NumberInput,
  SegmentedControl,
  StepIndicator,
} from '@/components/ui';
import { IconPlus } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import type { HousingStatus } from '@/lib/engine-types';
import {
  LIMITS,
  newChildId,
  type FieldErrors,
  type FormAdult,
  type FormState,
} from '@/lib/sim/form';
import { AdultFields } from './AdultFields';

export type StepId = 'foyer' | 'adult0' | 'adult1' | 'logement' | 'aides';

export const STEP_LABEL: Record<StepId, string> = {
  foyer: 'Foyer',
  adult0: 'Vous',
  adult1: 'Conjoint·e',
  logement: 'Logement',
  aides: 'Aides',
};

export const MAX_CHILDREN = 8;

const HOUSING: Array<{ value: HousingStatus; label: string }> = [
  { value: 'locataire', label: 'Locataire' },
  { value: 'proprietaire', label: 'Propriétaire, sans crédit' },
  { value: 'proprietaire_credit', label: 'Propriétaire, avec crédit' },
  { value: 'gratuit', label: 'Hébergé·e gratuitement' },
];

export interface InputFormProps {
  form: FormState;
  setForm: (updater: (f: FormState) => FormState) => void;
  errors: FieldErrors;
  steps: StepId[];
  /** Index in `steps` — only used below 640 px; wider screens show every section. */
  step: number;
  onStep: (index: number) => void;
  onFinish: () => void;
  affinerOpen: boolean;
}

export function InputForm({
  form,
  setForm,
  errors,
  steps,
  step,
  onStep,
  onFinish,
  affinerOpen,
}: InputFormProps) {
  const current = steps[step] ?? steps[0]!;
  const patchAdult = (i: 0 | 1) => (patch: Partial<FormAdult>) =>
    setForm((f) => {
      const adults: FormState['adults'] = [f.adults[0], f.adults[1]];
      adults[i] = { ...adults[i], ...patch };
      return { ...f, adults };
    });

  // Move keyboard / screen-reader focus to the new step's title when the stepper moves (mobile).
  const focusToken = useRef(0);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const stepperRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (focusToken.current > 0 && window.matchMedia('(max-width: 639.98px)').matches) {
      // bring the progress bar + the new question to the top, then move focus to the question's title
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      stepperRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      sectionRefs.current[current]?.focus({ preventScroll: true });
    }
  }, [step, current]);
  const go = (i: number) => {
    focusToken.current++;
    onStep(i);
  };

  // Focus the age field of a freshly added child.
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    if (pendingFocus.current) {
      document.getElementById(`child-age-${pendingFocus.current}`)?.focus();
      pendingFocus.current = null;
    }
  }, [form.children.length]);

  const hasKidUnder6 = form.children.some((c) => c.age !== null && c.age < 6);
  const isLast = step >= steps.length - 1;
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const section = (id: StepId, title: string, body: ReactNode, n: number) => (
    <section
      key={id}
      data-step={id}
      className={cn('card min-w-0', id !== current && 'max-sm:hidden')}
    >
      <fieldset className="min-w-0">
        <legend className="mb-5 w-full p-0">
          <span
            ref={(el) => {
              sectionRefs.current[id] = el;
            }}
            tabIndex={-1}
            className="flex items-center gap-3 font-serif text-xl font-medium text-ink outline-none sm:text-2xl"
          >
            <span
              aria-hidden="true"
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft font-sans text-sm font-bold text-accent"
            >
              {n}
            </span>
            {title}
          </span>
        </legend>
        <div className="space-y-6">{body}</div>
      </fieldset>
    </section>
  );

  const numbered = (id: StepId) => steps.indexOf(id) + 1;

  return (
    <div className="space-y-5">
      <h2 className="sr-only">Votre situation</h2>

      <div ref={stepperRef} className="scroll-mt-4 sm:hidden">
        <StepIndicator steps={steps.map((s) => STEP_LABEL[s])} current={step} />
      </div>

      {section(
        'foyer',
        'Votre foyer',
        <>
          <SegmentedControl
            legend="Vous vivez…"
            options={[
              { value: 'seul', label: 'Seul·e' },
              { value: 'couple', label: 'En couple' },
            ]}
            value={form.couple ? 'couple' : 'seul'}
            onChange={(v) => set({ couple: v === 'couple' })}
          />
          {form.couple && (
            <SegmentedControl
              legend="Êtes-vous marié·e ou pacsé·e ?"
              hint="Cela ne change que l’impôt d’aujourd’hui. Avec le plan, l’impôt est individuel."
              options={[
                { value: 'oui', label: 'Oui' },
                { value: 'non', label: 'Non' },
              ]}
              value={form.marriedOrPacs ? 'oui' : 'non'}
              onChange={(v) => set({ marriedOrPacs: v === 'oui' })}
            />
          )}

          <fieldset className="min-w-0 space-y-3">
            <legend className="text-[0.9375rem] font-semibold text-ink">Enfants à charge</legend>
            <p className="-mt-2 text-sm text-ink-3">
              De 18 à 24 ans, un·e jeune compte comme enfant à charge s’il ou elle est rattaché·e à
              votre foyer fiscal.
            </p>
            {form.children.length > 0 && (
              <ul className="space-y-3">
                {form.children.map((c, i) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-end gap-x-5 gap-y-1 rounded-md border border-rule bg-sunken/50 p-3"
                  >
                    <NumberInput
                      id={`child-age-${c.id}`}
                      label={`Âge de l’enfant ${i + 1}`}
                      unit="ans"
                      value={c.age}
                      onChange={(age) =>
                        setForm((f) => ({
                          ...f,
                          children: f.children.map((x) => (x.id === c.id ? { ...x, age } : x)),
                        }))
                      }
                      min={LIMITS.childAge.min}
                      max={LIMITS.childAge.max}
                      step={1}
                      error={errors[`child${i}.age`]}
                      fieldClassName="w-40"
                    />
                    <div className="min-w-0 flex-1 basis-56 space-y-1">
                      <Checkbox
                        label="AEEH"
                        hint="Allocation d’éducation de l’enfant handicapé"
                        checked={c.aeeh}
                        onChange={(aeeh) =>
                          setForm((f) => ({
                            ...f,
                            children: f.children.map((x) =>
                              x.id === c.id ? { ...x, aeeh, cmi: aeeh ? x.cmi : false } : x,
                            ),
                          }))
                        }
                      />
                      {c.aeeh && (
                        <Checkbox
                          label="Carte mobilité inclusion – invalidité (taux ≥ 80 %)"
                          hint="L’AEEH existe dès 50 % de taux d’incapacité. La carte « invalidité » (80 % ou plus) ouvre seule le supplément prévu par le plan, pour les enfants."
                          checked={c.cmi}
                          onChange={(cmi) =>
                            setForm((f) => ({
                              ...f,
                              children: f.children.map((x) => (x.id === c.id ? { ...x, cmi } : x)),
                            }))
                          }
                        />
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Retirer l’enfant ${i + 1}`}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          children: f.children.filter((x) => x.id !== c.id),
                        }))
                      }
                    >
                      Retirer
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button
              variant="secondary"
              disabled={form.children.length >= MAX_CHILDREN}
              onClick={() => {
                const id = newChildId();
                pendingFocus.current = id;
                setForm((f) => ({
                  ...f,
                  children: [
                    ...f.children,
                    { id, age: form.children.length === 0 ? 8 : null, aeeh: false, cmi: false },
                  ],
                }));
              }}
            >
              <IconPlus size={16} />
              {form.children.length === 0 ? 'Ajouter un enfant' : 'Ajouter un autre enfant'}
            </Button>
          </fieldset>
        </>,
        numbered('foyer'),
      )}

      {section(
        'adult0',
        form.couple ? 'Vous' : 'Votre situation',
        <AdultFields
          index={0}
          who="vous"
          idPrefix="a0"
          value={form.adults[0]}
          onChange={patchAdult(0)}
          errors={errors}
        />,
        numbered('adult0'),
      )}

      {form.couple &&
        section(
          'adult1',
          'Votre conjoint·e',
          <AdultFields
            index={1}
            who="conjoint"
            idPrefix="a1"
            value={form.adults[1]}
            onChange={patchAdult(1)}
            errors={errors}
          />,
          numbered('adult1'),
        )}

      {section(
        'logement',
        'Votre logement',
        <>
          <SegmentedControl
            legend="Vous êtes…"
            options={HOUSING}
            value={form.housing.status}
            onChange={(status) => set({ housing: { ...form.housing, status } })}
          />
          {form.housing.status === 'locataire' && (
            <>
              <NumberInput
                id="rent"
                label="Loyer mensuel hors charges"
                hint="Sans les charges ni le chauffage. Déduisez l’aide au logement si elle est versée au propriétaire."
                unit="€/mois"
                value={form.housing.rentMonthly}
                onChange={(rentMonthly) => set({ housing: { ...form.housing, rentMonthly } })}
                min={0}
                max={LIMITS.rentMax}
                step={25}
                error={errors['housing.rent']}
                fieldClassName="w-full sm:w-72"
              />
              <SegmentedControl
                legend="Zone de votre logement"
                hint="Elle fixe le plafond de loyer retenu pour l’aide au logement. Zone 1 : Paris et son agglomération. Zone 2 : grandes villes (plus de 100 000 habitants) et reste de l’Île-de-France. Zone 3 : le reste de la France."
                options={[
                  { value: '1', label: <ZoneLabel n={1} text="Paris et agglomération" /> },
                  { value: '2', label: <ZoneLabel n={2} text="Grandes villes" /> },
                  { value: '3', label: <ZoneLabel n={3} text="Reste de la France" /> },
                ]}
                value={String(form.housing.zone) as '1' | '2' | '3'}
                onChange={(z) =>
                  set({ housing: { ...form.housing, zone: Number(z) as 1 | 2 | 3 } })
                }
              />
            </>
          )}
        </>,
        numbered('logement'),
      )}

      {section(
        'aides',
        'Vos aides',
        <>
          <p className="text-[0.9375rem] text-ink-2">
            Vous n’avez rien à saisir : nous calculons le RSA, la prime d’activité, les aides au
            logement et les allocations familiales à partir de votre situation.
          </p>
          <Checkbox
            label="Je ne touche pas ces aides"
            hint="Certains foyers ne demandent pas les aides auxquelles ils ont droit. Cochez si c’est votre cas : le calcul d’aujourd’hui n’en tiendra pas compte."
            checked={form.nonRecours}
            onChange={(nonRecours) => set({ nonRecours })}
          />
          {!form.nonRecours && (
            <div className="space-y-4">
              <Checkbox
                label="Je touche un autre montant que celui calculé"
                hint="Si le total versé par la CAF ne correspond pas à votre situation, indiquez-le."
                checked={form.cafOverrideOn}
                onChange={(cafOverrideOn) => set({ cafOverrideOn })}
              />
              {form.cafOverrideOn && (
                <NumberInput
                  id="caf"
                  label="Total versé chaque mois par la CAF"
                  hint="Toutes aides confondues : RSA, prime d’activité, logement, famille."
                  unit="€/mois"
                  value={form.cafOverrideMonthly}
                  onChange={(cafOverrideMonthly) => set({ cafOverrideMonthly })}
                  min={0}
                  max={LIMITS.cafMax}
                  step={25}
                  error={errors.caf}
                  fieldClassName="w-full sm:w-72"
                />
              )}
            </div>
          )}

          <Disclosure
            variant="card"
            summary="Affiner le calcul"
            meta="facultatif"
            defaultOpen={affinerOpen}
          >
            <Refine form={form} setForm={setForm} errors={errors} hasKidUnder6={hasKidUnder6} />
          </Disclosure>
        </>,
        numbered('aides'),
      )}

      <div className="flex items-center justify-between gap-3 sm:hidden">
        <Button variant="secondary" disabled={step === 0} onClick={() => go(step - 1)}>
          Précédent
        </Button>
        {isLast ? (
          <Button onClick={onFinish}>Voir mon résultat</Button>
        ) : (
          <Button onClick={() => go(step + 1)}>Suivant</Button>
        )}
      </div>
    </div>
  );
}

function ZoneLabel({ n, text }: { n: number; text: string }) {
  return (
    <span className="block text-center leading-tight">
      <span className="block">Zone {n}</span>
      <span className="block text-xs font-normal opacity-80">{text}</span>
    </span>
  );
}

const WORK_RATIOS = [
  { value: '1', label: 'Temps plein' },
  { value: '0.8', label: '80 %' },
  { value: '0.5', label: 'Mi-temps (50 %)' },
] as const;

const ratioKey = (r: number): '1' | '0.8' | '0.5' => (r >= 0.99 ? '1' : r >= 0.65 ? '0.8' : '0.5');

function Refine({
  form,
  setForm,
  errors,
  hasKidUnder6,
}: {
  form: FormState;
  setForm: InputFormProps['setForm'];
  errors: FieldErrors;
  hasKidUnder6: boolean;
}) {
  const setExtras = (patch: Partial<FormState['extras']>) =>
    setForm((f) => ({ ...f, extras: { ...f.extras, ...patch } }));
  const adults = form.couple ? [0, 1] : [0];
  const salaried = adults.filter((i) => form.adults[i]!.activity === 'salarie');
  return (
    <div className="space-y-6 pt-1">
      {salaried.map((i) => (
        <SegmentedControl
          key={i}
          legend={
            form.couple
              ? `Temps de travail ${i === 0 ? 'de votre part' : 'de votre conjoint·e'}`
              : 'Temps de travail'
          }
          hint="Votre salaire reste celui que vous indiquez : cette information sert surtout à calculer votre heure de travail."
          options={[...WORK_RATIOS]}
          value={ratioKey(form.adults[i]!.workRatio)}
          onChange={(v) =>
            setForm((f) => {
              const a: FormState['adults'] = [f.adults[0], f.adults[1]];
              a[i as 0 | 1] = { ...a[i as 0 | 1], workRatio: Number(v) };
              return { ...f, adults: a };
            })
          }
        />
      ))}
      {!form.couple && form.children.length > 0 && (
        <Checkbox
          label="Je me suis séparé·e il y a moins de 18 mois"
          hint="Le RSA et la prime d’activité sont alors majorés, même si le plus jeune enfant a plus de 3 ans."
          checked={form.isolementRecent}
          onChange={(isolementRecent) => setForm((f) => ({ ...f, isolementRecent }))}
        />
      )}
      {hasKidUnder6 && (
        <>
          <SegmentedControl
            legend="Garde des enfants de moins de 6 ans"
            options={[
              { value: 'none', label: 'Non précisé' },
              { value: 'parent', label: 'Un parent' },
              { value: 'creche', label: 'Crèche' },
              { value: 'assistante_maternelle', label: 'Assistante maternelle' },
            ]}
            value={form.extras.childcare}
            onChange={(childcare) => setExtras({ childcare })}
          />
          {(form.extras.childcare === 'creche' ||
            form.extras.childcare === 'assistante_maternelle') && (
            <NumberInput
              id="childcare-cost"
              label="Coût de garde mensuel"
              hint="Ce que vous payez après aides."
              unit="€/mois"
              value={form.extras.childcareCostMonthly}
              onChange={(childcareCostMonthly) => setExtras({ childcareCostMonthly })}
              min={0}
              max={5000}
              step={25}
              error={errors['extras.childcareCost']}
              fieldClassName="w-full sm:w-72"
            />
          )}
        </>
      )}
      <NumberInput
        id="emploi-domicile"
        label="Dépenses d’emploi à domicile"
        hint="Ménage, garde à domicile, soutien scolaire : total sur l’année."
        unit="€/an"
        value={form.extras.emploiDomicileAnnual}
        onChange={(emploiDomicileAnnual) => setExtras({ emploiDomicileAnnual })}
        min={0}
        max={LIMITS.moneyAnnualMax}
        step={100}
        error={errors['extras.emploiDomicile']}
        fieldClassName="w-full sm:w-72"
      />
      <NumberInput
        id="dons"
        label="Dons aux associations"
        hint="Total sur l’année."
        unit="€/an"
        value={form.extras.donsAnnual}
        onChange={(donsAnnual) => setExtras({ donsAnnual })}
        min={0}
        max={LIMITS.moneyAnnualMax}
        step={50}
        error={errors['extras.dons']}
        fieldClassName="w-full sm:w-72"
      />
      <NumberInput
        id="consumption"
        label="Dépenses de consommation du foyer"
        hint="Pour estimer la TVA. Laissez vide : nous l’estimons à partir de votre revenu."
        unit="€/mois"
        value={form.extras.consumptionMonthly}
        onChange={(consumptionMonthly) => setExtras({ consumptionMonthly })}
        min={0}
        max={100000}
        step={50}
        error={errors['extras.consumption']}
        fieldClassName="w-full sm:w-72"
      />
    </div>
  );
}
