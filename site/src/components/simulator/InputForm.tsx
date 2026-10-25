import { useEffect, useRef, type ReactNode } from 'react';
import {
  Button,
  Checkbox,
  Disclosure,
  NumberInput,
  SegmentedControl,
  StepIndicator,
  Term,
} from '@/components/ui';
import { IconPlus } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import type { HousingStatus } from '@/lib/engine-types';
import {
  asksChildSupport,
  LIMITS,
  newChildId,
  stepOfError,
  STEPS,
  type ChildcareMode,
  type FieldErrors,
  type FormAdult,
  type FormState,
  type StepId,
  type ZoneAnswer,
} from '@/lib/sim/form';
import { AdultFields } from './AdultFields';
import { focusField } from './focus';

export type { StepId };

/** Short names of the four steps (the same four for a person alone and for a couple). */
export const STEP_LABEL: Record<StepId, string> = {
  foyer: 'Foyer',
  adults: 'Vous',
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

const CHILDCARE: Array<{ value: ChildcareMode; label: string }> = [
  { value: 'parent', label: 'Un parent garde les enfants' },
  { value: 'creche', label: 'Crèche (municipale ou associative)' },
  { value: 'micro_creche', label: 'Micro-crèche' },
  { value: 'assistante_maternelle', label: 'Assistante maternelle' },
  { value: 'none', label: 'Autre, ou je ne sais pas' },
];

export interface InputFormProps {
  form: FormState;
  setForm: (updater: (f: FormState) => FormState) => void;
  errors: FieldErrors;
  /** Show every error now (a « Suivant » / « Voir mon résultat » attempt was made). */
  showErrors: boolean;
  onReveal: () => void;
  /** Index in `STEPS` — only used below 640 px; wider screens show every section. */
  step: number;
  onStep: (index: number) => void;
  onFinish: () => void;
  affinerOpen: boolean;
}

export function InputForm({
  form,
  setForm,
  errors,
  showErrors,
  onReveal,
  step,
  onStep,
  onFinish,
  affinerOpen,
}: InputFormProps) {
  const current = STEPS[step] ?? STEPS[0]!;
  const couple = form.couple === true;
  const patchAdult = (i: 0 | 1) => (patch: Partial<FormAdult>) =>
    setForm((f) => {
      const adults: FormState['adults'] = [f.adults[0], f.adults[1]];
      adults[i] = { ...adults[i], ...patch };
      return { ...f, adults };
    });

  // Move keyboard / screen-reader focus to the new step's title when the stepper moves (mobile),
  // or to the first field to fix when « Voir mon résultat » found something missing.
  const focusToken = useRef(0);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const stepperRef = useRef<HTMLDivElement>(null);
  const pendingField = useRef<string | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (focusToken.current > 0 && window.matchMedia('(max-width: 639.98px)').matches) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      stepperRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      if (pendingField.current) {
        focusField(pendingField.current);
        pendingField.current = null;
      } else {
        sectionRefs.current[current]?.focus({ preventScroll: true });
      }
    }
  }, [step, current]);

  const go = (i: number) => {
    focusToken.current++;
    onStep(i);
  };

  const firstErrorIn = (pred: (key: string) => boolean) => Object.keys(errors).find(pred);

  const next = () => {
    const bad = firstErrorIn((k) => stepOfError(k) === current);
    if (bad) {
      onReveal();
      requestAnimationFrame(() => focusField(bad));
      return;
    }
    go(step + 1);
  };

  const finish = () => {
    const bad = firstErrorIn(() => true);
    if (bad) {
      onReveal();
      const target = STEPS.indexOf(stepOfError(bad));
      if (target !== step) {
        pendingField.current = bad;
        go(target);
      } else requestAnimationFrame(() => focusField(bad));
      return;
    }
    onFinish();
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
  const isLast = step >= STEPS.length - 1;
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  const err = (key: string) => (showErrors ? errors[key] : undefined);

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
            className="step-title flex items-center gap-3 font-serif text-xl font-medium text-ink outline-none sm:text-2xl"
          >
            <span
              aria-hidden="true"
              className="step-num flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft font-sans text-sm font-bold text-accent"
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

  const owner =
    form.housing.status === 'proprietaire' || form.housing.status === 'proprietaire_credit';

  return (
    <div className="space-y-5">
      <h2 className="sr-only">Vos réponses</h2>

      <div ref={stepperRef} className="scroll-mt-4 sm:hidden">
        <StepIndicator steps={STEPS.map((s) => STEP_LABEL[s])} current={step} />
      </div>

      {section(
        'foyer',
        'Votre foyer',
        <>
          <div data-field="foyer.couple">
            <SegmentedControl
              legend="Vous vivez…"
              layout="stack"
              options={[
                { value: 'seul', label: 'Seul / seule (célibataire, veuf ou veuve, divorcé…)' },
                { value: 'couple', label: 'En couple' },
              ]}
              value={form.couple === null ? null : form.couple ? 'couple' : 'seul'}
              onChange={(v) => set({ couple: v === 'couple' })}
              error={err('foyer.couple')}
            />
          </div>
          {couple && (
            <div data-field="foyer.married">
              <SegmentedControl
                legend="Êtes-vous marié·e ou pacsé·e ?"
                hint="Mariés ou pacsés, vous payez l’impôt d’aujourd’hui ensemble ; sinon, chacun le sien. Cela change le point de départ. Avec le plan, l’impôt est individuel."
                options={[
                  { value: 'oui', label: 'Oui' },
                  { value: 'non', label: 'Non' },
                ]}
                value={form.marriedOrPacs === null ? null : form.marriedOrPacs ? 'oui' : 'non'}
                onChange={(v) => set({ marriedOrPacs: v === 'oui' })}
                error={err('foyer.married')}
              />
            </div>
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
                    <div data-field={`child${i}.age`}>
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
                        validate={showErrors}
                        fieldClassName="w-40"
                      />
                    </div>
                    <div className="min-w-0 flex-1 basis-56 space-y-1">
                      <Checkbox
                        label="Enfant handicapé (AEEH)"
                        hint={
                          <>
                            Allocation d’éducation de l’enfant handicapé (
                            <Term id="aeeh">AEEH</Term>
                            ).
                          </>
                        }
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
                          label="Carte mobilité inclusion « invalidité » (taux de 80 % ou plus)"
                          hint="L’AEEH existe dès 50 % de taux d’incapacité. Seule la carte « invalidité » (80 % ou plus) ouvre le supplément prévu par le plan pour les enfants."
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
                  children: [...f.children, { id, age: null, aeeh: false, cmi: false }],
                }));
              }}
            >
              <IconPlus size={16} />
              {form.children.length === 0 ? 'Ajouter un enfant' : 'Ajouter un autre enfant'}
            </Button>
          </fieldset>

          {hasKidUnder6 && (
            <div className="space-y-4">
              <SegmentedControl
                legend="Comment sont gardés vos enfants de moins de 6 ans ?"
                layout="stack"
                hint={
                  <>
                    Le plan supprime l’aide à la garde (<Term id="cmg">CMG</Term>) : la réponse
                    compte dans le résultat.
                  </>
                }
                options={CHILDCARE}
                value={form.extras.childcare}
                onChange={(childcare) =>
                  setForm((f) => ({ ...f, extras: { ...f.extras, childcare } }))
                }
              />
              {form.extras.childcare !== 'none' && form.extras.childcare !== 'parent' && (
                <div data-field="extras.childcareCost">
                  <NumberInput
                    id="childcare-cost"
                    label="Ce que coûte la garde, par mois"
                    hint="Le total payé avant les aides (salaire et indemnités de l’assistante maternelle, ou facture de la structure). Laissez vide si vous ne savez pas : le simulateur retient un coût moyen et vous le dit dans le résultat."
                    unit="€/mois"
                    value={form.extras.childcareCostMonthly}
                    onChange={(childcareCostMonthly) =>
                      setForm((f) => ({ ...f, extras: { ...f.extras, childcareCostMonthly } }))
                    }
                    min={0}
                    max={LIMITS.childcareCostMax}
                    step={25}
                    error={errors['extras.childcareCost']}
                    validate={showErrors}
                    fieldClassName="w-full sm:w-72"
                  />
                </div>
              )}
            </div>
          )}

          {asksChildSupport(form) && (
            <div className="space-y-4">
              <div data-field="foyer.childSupport">
                <SegmentedControl
                  legend="Recevez-vous une pension alimentaire pour vos enfants ?"
                  hint={
                    <>
                      Elle réduit l’allocation de soutien familial (<Term id="asf">ASF</Term>), que
                      le plan supprime aussi. Si vous n’en recevez pas, répondez « Non ».
                    </>
                  }
                  options={[
                    { value: 'oui', label: 'Oui' },
                    { value: 'non', label: 'Non' },
                  ]}
                  value={
                    form.childSupport.received === null
                      ? null
                      : form.childSupport.received
                        ? 'oui'
                        : 'non'
                  }
                  onChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      childSupport: {
                        received: v === 'oui',
                        monthly: v === 'oui' ? f.childSupport.monthly : null,
                      },
                    }))
                  }
                  error={err('foyer.childSupport')}
                />
              </div>
              {form.childSupport.received === true && (
                <div data-field="childSupport.amount">
                  <NumberInput
                    id="child-support"
                    label="Montant reçu chaque mois"
                    hint="Pour l’ensemble des enfants."
                    unit="€/mois"
                    value={form.childSupport.monthly}
                    onChange={(monthly) =>
                      setForm((f) => ({ ...f, childSupport: { ...f.childSupport, monthly } }))
                    }
                    min={0}
                    max={LIMITS.childSupportMax}
                    step={25}
                    error={errors['childSupport.amount']}
                    validate={showErrors}
                    fieldClassName="w-full sm:w-72"
                  />
                </div>
              )}
            </div>
          )}
        </>,
        1,
      )}

      {section(
        'adults',
        couple ? 'Vous deux' : 'Votre situation',
        <>
          {couple && <h3 className="text-lg font-semibold text-ink">Vous</h3>}
          <AdultFields
            index={0}
            you
            idPrefix="a0"
            value={form.adults[0]}
            onChange={patchAdult(0)}
            errors={errors}
            validate={showErrors}
          />
          {couple && (
            <div className="space-y-6 border-t border-rule pt-6">
              <h3 className="text-lg font-semibold text-ink">Votre conjoint·e</h3>
              <AdultFields
                index={1}
                you={false}
                idPrefix="a1"
                value={form.adults[1]}
                onChange={patchAdult(1)}
                errors={errors}
                validate={showErrors}
              />
            </div>
          )}
        </>,
        2,
      )}

      {section(
        'logement',
        'Votre logement',
        <>
          <div data-field="housing.status">
            <SegmentedControl
              legend="Vous êtes…"
              options={HOUSING}
              value={form.housing.status}
              onChange={(status) => set({ housing: { ...form.housing, status } })}
              error={err('housing.status')}
            />
          </div>
          {owner && (
            <p className="rounded-md bg-sunken px-3 py-2 text-sm text-ink-2">
              Propriétaire : pas d’aide au logement dans ce calcul. La mensualité du crédit et la
              taxe foncière ne sont pas comptées : cette réponse ne change rien d’autre au résultat.
            </p>
          )}
          {form.housing.status === 'locataire' && (
            <>
              <div data-field="housing.rent">
                <NumberInput
                  id="rent"
                  label="Loyer mensuel hors charges"
                  hint="Le loyer inscrit dans votre bail, sans les charges ni le chauffage. Si l’aide au logement est versée directement à votre propriétaire, indiquez quand même le loyer complet : le simulateur calcule l’aide lui-même."
                  unit="€/mois"
                  value={form.housing.rentMonthly}
                  onChange={(rentMonthly) => set({ housing: { ...form.housing, rentMonthly } })}
                  min={0}
                  max={LIMITS.rentMax}
                  step={25}
                  error={errors['housing.rent']}
                  validate={showErrors}
                  fieldClassName="w-full sm:w-72"
                />
              </div>
              <div data-field="housing.zone" className="space-y-3">
                <SegmentedControl<`${ZoneAnswer}`>
                  legend="Zone de votre logement"
                  hint={
                    <>
                      Les <Term id="zones">zones</Term> classent les communes selon la cherté des
                      loyers ; elles fixent le plafond de loyer retenu pour l’
                      <Term id="aides-logement">aide au logement</Term>.
                    </>
                  }
                  options={[
                    { value: '1', label: <ZoneLabel text="Zone 1" /> },
                    { value: '2', label: <ZoneLabel text="Zone 2" /> },
                    { value: '3', label: <ZoneLabel text="Zone 3" /> },
                    { value: 'inconnue', label: <ZoneLabel text="Je ne sais pas" /> },
                  ]}
                  value={
                    form.housing.zone === null ? null : (`${form.housing.zone}` as `${ZoneAnswer}`)
                  }
                  onChange={(z) =>
                    set({
                      housing: {
                        ...form.housing,
                        zone: z === 'inconnue' ? 'inconnue' : (Number(z) as 1 | 2 | 3),
                      },
                    })
                  }
                  error={err('housing.zone')}
                />
                <ZoneHelp />
              </div>
            </>
          )}
        </>,
        3,
      )}

      {section(
        'aides',
        'Vos aides',
        <>
          <p className="text-[0.9375rem] text-ink-2">
            Vous n’avez rien à saisir : nous calculons pour vous le <Term id="rsa">RSA</Term>
            {', la '}
            <Term id="prime-activite">prime d’activité</Term>, les aides au logement et les
            allocations familiales. Dans le résultat, vous verrez la liste de ces aides, avec la
            raison quand l’une d’elles est à 0 €.
          </p>
          <Checkbox
            label="Je ne touche pas ces aides"
            hint={
              <>
                Certains foyers ne demandent pas les aides auxquelles ils ont droit (
                <Term id="non-recours">non-recours</Term>). Cochez si c’est votre cas : le calcul
                d’aujourd’hui n’en tiendra pas compte.
              </>
            }
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
                <div data-field="caf">
                  <NumberInput
                    id="caf"
                    label="Total versé chaque mois par la CAF"
                    hint="Toutes aides confondues : RSA, prime d’activité, logement, famille."
                    unit="€/mois"
                    value={form.cafOverrideMonthly}
                    onChange={(cafOverrideMonthly) => set({ cafOverrideMonthly })}
                    min={0}
                    max={LIMITS.cafMax}
                    step={25}
                    error={errors.caf}
                    validate={showErrors}
                    fieldClassName="w-full sm:w-72"
                  />
                </div>
              )}
            </div>
          )}

          <Disclosure
            variant="card"
            summary="Affiner le calcul"
            meta="facultatif"
            defaultOpen={affinerOpen}
          >
            <Refine form={form} setForm={setForm} errors={errors} showErrors={showErrors} />
          </Disclosure>
        </>,
        4,
      )}

      <div className="flex items-center justify-between gap-3 sm:hidden">
        <Button variant="secondary" disabled={step === 0} onClick={() => go(step - 1)}>
          Précédent
        </Button>
        {isLast ? (
          <Button onClick={finish}>Voir mon résultat</Button>
        ) : (
          <Button onClick={next}>Suivant</Button>
        )}
      </div>
    </div>
  );
}

function ZoneLabel({ text }: { text: string }) {
  return <span className="block text-center leading-tight">{text}</span>;
}

/** Concrete examples, always visible (no tooltip): the question people hesitated on most (Roubaix, Montreuil…). */
function ZoneHelp() {
  return (
    <div className="space-y-2 rounded-md bg-sunken px-3.5 py-3 text-sm text-ink-2">
      <p className="font-semibold text-ink">Dans quelle zone est votre commune ?</p>
      <ul className="list-disc space-y-1 ps-5">
        <li>
          <strong className="text-ink">Zone 1</strong>&#8239;: Paris et la petite couronne
          (Montreuil, Saint-Denis, Boulogne-Billancourt…), plus quelques communes proches de Paris.
        </li>
        <li>
          <strong className="text-ink">Zone 2</strong>&#8239;: les villes de plus de 100 000
          habitants et leur agglomération (Lille, Lyon, Marseille, Toulouse, Nantes, Bordeaux,
          Strasbourg…), le reste de l’Île-de-France. Roubaix et Tourcoing : zone 2 (agglomération
          lilloise).
        </li>
        <li>
          <strong className="text-ink">Zone 3</strong>&#8239;: le reste de la France — villes
          moyennes, petites villes, campagne.
        </li>
      </ul>
      <p>
        Un doute ? Choisissez « Je ne sais pas » : le simulateur retient alors la zone 2, le cas
        intermédiaire.
      </p>
    </div>
  );
}

const WORK_RATIOS = [
  { value: '1', label: 'Temps plein' },
  { value: '0.8', label: '80 %' },
  { value: '0.5', label: 'Mi-temps (50 %)' },
] as const;

const ratioKey = (r: number): '1' | '0.8' | '0.5' => (r >= 0.99 ? '1' : r >= 0.65 ? '0.8' : '0.5');

function Refine({
  form,
  setForm,
  errors,
  showErrors,
}: {
  form: FormState;
  setForm: InputFormProps['setForm'];
  errors: FieldErrors;
  showErrors: boolean;
}) {
  const setExtras = (patch: Partial<FormState['extras']>) =>
    setForm((f) => ({ ...f, extras: { ...f.extras, ...patch } }));
  const couple = form.couple === true;
  const adults = couple ? [0, 1] : [0];
  const salaried = adults.filter((i) => {
    const a = form.adults[i]!;
    return a.activity === 'salarie' && a.salaryStatus !== null && a.salaryStatus !== 'tns';
  });
  const retired = adults.filter((i) => form.adults[i]!.activity === 'retraite');
  const patchAdult = (i: number, patch: Partial<FormAdult>) =>
    setForm((f) => {
      const a: FormState['adults'] = [f.adults[0], f.adults[1]];
      a[i as 0 | 1] = { ...a[i as 0 | 1], ...patch };
      return { ...f, adults: a };
    });
  return (
    <div className="space-y-6 pt-1">
      {salaried.map((i) => (
        <SegmentedControl
          key={i}
          legend={
            couple
              ? `Temps de travail ${i === 0 ? 'de votre part' : 'de votre conjoint·e'}`
              : 'Temps de travail'
          }
          hint="Votre salaire reste celui que vous indiquez : cette information sert surtout à calculer votre heure de travail."
          options={[...WORK_RATIOS]}
          value={ratioKey(form.adults[i]!.workRatio)}
          onChange={(v) => patchAdult(i, { workRatio: Number(v) })}
        />
      ))}
      {retired.map((i) => (
        <div key={i} data-field={`adult${i}.pensionYear`}>
          <NumberInput
            id={`a${i}-pension-year`}
            label={
              couple
                ? `Année de départ à la retraite ${i === 0 ? '(vous)' : '(votre conjoint·e)'}`
                : 'Année de départ à la retraite'
            }
            hint="Laissez vide si vous êtes déjà à la retraite. Le plan traite différemment les retraites qui ne commenceraient qu’à partir du 1er janvier 2028."
            value={form.adults[i]!.pensionStartYear}
            onChange={(pensionStartYear) => patchAdult(i, { pensionStartYear })}
            min={LIMITS.pensionYear.min}
            max={LIMITS.pensionYear.max}
            step={1}
            error={errors[`adult${i}.pensionYear`]}
            validate={showErrors}
            fieldClassName="w-48 max-w-full"
          />
        </div>
      ))}
      {!couple && form.children.length > 0 && (
        <Checkbox
          label="Je me suis séparé·e il y a moins de 18 mois"
          hint="Le RSA et la prime d’activité sont alors majorés, même si le plus jeune enfant a plus de 3 ans."
          checked={form.isolementRecent}
          onChange={(isolementRecent) => setForm((f) => ({ ...f, isolementRecent }))}
        />
      )}
      <NumberInput
        id="emploi-domicile"
        label="Dépenses d’emploi à domicile"
        hint="Ménage, garde à domicile, soutien scolaire : total sur l’année."
        unit="€/an"
        value={form.extras.emploiDomicileAnnual}
        onChange={(emploiDomicileAnnual) => setExtras({ emploiDomicileAnnual })}
        min={0}
        max={LIMITS.moneyAnnualMax}
        step={100}
        error={errors['extras.emploiDomicile']}
        validate={showErrors}
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
        validate={showErrors}
        fieldClassName="w-full sm:w-72"
      />
      <NumberInput
        id="consumption"
        label="Dépenses de consommation du foyer"
        hint={
          <>
            Pour estimer la <Term id="tva">TVA</Term>. Laissez vide : nous l’estimons à partir de
            votre revenu.
          </>
        }
        unit="€/mois"
        value={form.extras.consumptionMonthly}
        onChange={(consumptionMonthly) => setExtras({ consumptionMonthly })}
        min={0}
        max={100000}
        step={50}
        error={errors['extras.consumption']}
        validate={showErrors}
        fieldClassName="w-full sm:w-72"
      />
    </div>
  );
}
