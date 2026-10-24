import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Button, Callout } from '@/components/ui';
import { compare, decodeState, DEFAULT_HYPOTHESES, encodeState, PARAMS_META } from '@/lib/engine';
import type { Comparison, Household, Hypotheses, Period } from '@/lib/engine-types';
import { buildHeadline, headlineSentence, transfersOf } from '@/lib/sim/result';
import {
  defaultFormState,
  formToHousehold,
  hasExtras,
  householdToForm,
  type FormState,
} from '@/lib/sim/form';
import { CompareTable } from './CompareTable';
import { EarningsCurve } from './EarningsCurve';
import { Headline } from './Headline';
import { HourOfWork } from './HourOfWork';
import { HypothesesSection, NotModelled } from './Hypotheses';
import { InputForm, type StepId } from './InputForm';
import { ShareButton } from './ShareButton';
import { Transition } from './Transition';
import { Unquantified } from './Unquantified';
import { Waterfall } from './Waterfall';
import { cn } from '@/lib/cn';
import { periodLong } from '@/lib/sim/result';
import { withBase } from '@/lib/site';

const DEBOUNCE_MS = 250;
const STATE_HASH = /^#?v\d+\./;

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const PHONE_QUERY = '(max-width: 639.98px)';
function subscribePhone(cb: () => void) {
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}
/** True below 640 px: the stepper layout, where the detailed result is hidden while answering. */
function usePhone(): boolean {
  return useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}

interface Committed {
  household: Household;
  hyp: Hypotheses;
  period: Period;
}

type Computed = { comparison: Comparison; error: null } | { comparison: null; error: string };

function compute(c: Committed): Computed {
  try {
    return {
      comparison: compare(c.household, { period: c.period, hypotheses: c.hyp }),
      error: null,
    };
  } catch (e) {
    return { comparison: null, error: e instanceof Error ? e.message : 'Erreur de calcul' };
  }
}

const sameState = (a: Committed, b: Committed) =>
  a.hyp === b.hyp &&
  a.period === b.period &&
  JSON.stringify(a.household) === JSON.stringify(b.household);

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  el.focus({ preventScroll: true });
}

/**
 * The simulator island: form (stepper on phones) → live headline → detailed result.
 *
 *  - Every input is controlled; the engine only runs on the DEBOUNCED, VALIDATED household.
 *  - State lives in the URL hash (`#v1.<base64url>`): restored on load / hashchange, written with
 *    `history.replaceState` after the first interaction. Never in the query string, never sent anywhere.
 *  - On the server and on the first client render the default household is used (no hydration mismatch);
 *    a layout effect restores the hash before the first paint.
 */
export default function Simulator() {
  const [form, setFormRaw] = useState<FormState>(defaultFormState);
  const [hyp, setHypRaw] = useState<Hypotheses>(DEFAULT_HYPOTHESES);
  const [period, setPeriodRaw] = useState<Period>('steady');
  const [step, setStep] = useState(0);
  const [mobileView, setMobileView] = useState<'form' | 'result'>('form');
  const [affinerOpen, setAffinerOpen] = useState(false);
  const [hashNotice, setHashNotice] = useState<string | null>(null);
  const [headlineVisible, setHeadlineVisible] = useState(true);
  const touched = useRef(false);
  const phone = usePhone();

  const setForm = useCallback((u: (f: FormState) => FormState) => {
    touched.current = true;
    setFormRaw(u);
  }, []);
  const setHyp = useCallback((h: Hypotheses) => {
    touched.current = true;
    setHypRaw(h);
  }, []);
  const setPeriod = useCallback((p: Period) => {
    touched.current = true;
    setPeriodRaw(p);
  }, []);

  const parsed = useMemo(() => formToHousehold(form), [form]);

  const [committed, setCommitted] = useState<Committed>(() => ({
    household: formToHousehold(defaultFormState()).household!,
    hyp: DEFAULT_HYPOTHESES,
    period: 'steady',
  }));
  const computed = useMemo(() => compute(committed), [committed]);
  const comparison = computed.comparison;

  // Debounce: only valid households reach the engine; invalid ones keep the previous result on screen.
  useEffect(() => {
    const household = parsed.household;
    if (!household) return;
    const next: Committed = { household, hyp, period };
    if (sameState(next, committed)) return;
    const t = setTimeout(() => setCommitted(next), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [parsed.household, hyp, period, committed]);

  const invalid = parsed.household === null;
  const stale = useMemo(
    () => invalid || !sameState({ household: parsed.household!, hyp, period }, committed),
    [invalid, parsed.household, hyp, period, committed],
  );

  /* ── URL hash ─────────────────────────────────────────────────────────── */
  const latest = useRef(committed);
  latest.current = committed;

  const buildUrl = useCallback(() => {
    const c = latest.current;
    const hash = encodeState(c.household, c.hyp, c.period);
    return `${location.origin}${location.pathname}#${hash}`;
  }, []);

  const writeHash = useCallback(() => {
    const c = latest.current;
    history.replaceState(
      null,
      '',
      `${location.pathname}${location.search}#${encodeState(c.household, c.hyp, c.period)}`,
    );
  }, []);

  const applyHash = useCallback((hash: string): boolean => {
    if (!STATE_HASH.test(hash)) return false; // an in-page anchor such as #main: not ours
    const decoded = decodeState(hash.replace(/^#/, ''));
    if (!decoded) {
      setHashNotice('Ce lien ne semble pas complet : nous avons repris les valeurs de départ.');
      return true;
    }
    const f = householdToForm(decoded.household);
    setFormRaw(f);
    setHypRaw(decoded.hypotheses);
    setPeriodRaw(decoded.period);
    setCommitted({ household: decoded.household, hyp: decoded.hypotheses, period: decoded.period });
    setAffinerOpen(hasExtras(f));
    setMobileView('result');
    setStep(0);
    setHashNotice(null);
    touched.current = true;
    return true;
  }, []);

  useIsoLayoutEffect(() => {
    applyHash(window.location.hash);
  }, [applyHash]);

  useEffect(() => {
    const onHash = () => {
      if (!applyHash(window.location.hash) && touched.current) {
        // an anchor click (skip link…) replaced the state hash: put the shareable state back
        setTimeout(writeHash, 0);
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [applyHash, writeHash]);

  useEffect(() => {
    if (touched.current) writeHash();
  }, [committed, writeHash]);

  /* ── Layout state ─────────────────────────────────────────────────────── */
  const steps = useMemo<StepId[]>(
    () => ['foyer', 'adult0', ...(form.couple ? (['adult1'] as const) : []), 'logement', 'aides'],
    [form.couple],
  );
  const stepIndex = Math.min(step, steps.length - 1);

  const heroRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = heroRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => e && setHeadlineVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [mobileView]);

  const seeDetail = useCallback(() => {
    setMobileView('result');
    // wait for the result zone to be displayed on phones
    requestAnimationFrame(() => scrollToId('detail'));
  }, []);
  const editAnswers = useCallback(() => {
    setMobileView('form');
    setStep(0);
    requestAnimationFrame(() => scrollToId('situation'));
  }, []);

  const headline = comparison ? buildHeadline(comparison) : null;
  const hypothesesCount = comparison?.activeHypotheses.length ?? 4;

  const headlineProps = {
    comparison,
    period: committed.period,
    stale,
    invalid,
    getUrl: buildUrl,
    onSeeDetail: seeDetail,
    onSeeHypotheses: () => {
      setMobileView('result');
      requestAnimationFrame(() => scrollToId('hypotheses'));
    },
    onResetPeriod: () => setPeriod('steady'),
    hypothesesCount,
  } as const;

  return (
    <div className="wrap pb-24 lg:pb-16">
      <div className="space-y-4 pb-6">
        {hashNotice && (
          <Callout tone="note" title="Lien incomplet">
            <p>{hashNotice}</p>
          </Callout>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start lg:gap-10">
        {/* ── Questions ─────────────────────────────────────────────────── */}
        <div
          id="situation"
          tabIndex={-1}
          className={cn('min-w-0 outline-none', mobileView === 'result' && 'max-sm:hidden')}
        >
          <InputForm
            form={form}
            setForm={setForm}
            errors={parsed.errors}
            steps={steps}
            step={stepIndex}
            onStep={setStep}
            onFinish={seeDetail}
            affinerOpen={affinerOpen}
          />
        </div>

        {/* ── Live result (desktop sidebar) ─────────────────────────────── */}
        <aside aria-label="Résultat en direct" className="hidden lg:sticky lg:top-4 lg:block">
          <Headline variant="side" {...headlineProps} />
        </aside>
      </div>

      {/* ── Detailed result ─────────────────────────────────────────────── */}
      <div
        id="detail"
        tabIndex={-1}
        className={cn(
          'mt-6 space-y-8 outline-none sm:mt-12 lg:mt-14',
          mobileView === 'form' && 'max-sm:hidden',
        )}
      >
        <div ref={heroRef} className="space-y-3 lg:hidden">
          <Button variant="ghost" size="sm" className="sm:hidden" onClick={editAnswers}>
            ← Modifier mes réponses
          </Button>
          <Headline variant="hero" {...headlineProps} />
        </div>

        {comparison ? (
          <div className={cn('space-y-8 transition-opacity duration-200', stale && 'opacity-70')}>
            {comparison.warnings.length > 0 && (
              <Callout tone="note" title="À savoir sur ce calcul">
                <ul className="list-disc space-y-1 ps-5">
                  {comparison.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </Callout>
            )}

            <Waterfall comparison={comparison} periodLabel={periodLong(committed.period)} />
            <HourOfWork
              household={committed.household}
              hypotheses={committed.hyp}
              transfers={{
                baseline: transfersOf(comparison.baseline),
                plan: transfersOf(comparison.plan),
              }}
            />
            <CompareTable comparison={comparison} />
            <Unquantified
              promises={comparison.unquantified.promises}
              losses={comparison.unquantified.losses}
            />
            <Transition
              household={committed.household}
              hypotheses={committed.hyp}
              period={committed.period}
              onPick={(p) => {
                setPeriod(p);
                scrollToId('detail');
              }}
            />
            <EarningsCurve
              household={committed.household}
              hypotheses={committed.hyp}
              comparison={comparison}
            />
            <HypothesesSection value={hyp} onChange={setHyp} comparison={comparison} />
            <NotModelled items={comparison.notModelled} />
            <ShareSection getUrl={buildUrl}>
              Moteur de calcul, version {PARAMS_META.engineVersion}. {PARAMS_META.baselineYear}.
            </ShareSection>
          </div>
        ) : (
          <Callout
            tone="note"
            title={computed.error ? 'Le calcul a échoué' : 'En attente de vos réponses'}
          >
            <p>
              {computed.error
                ? 'Une erreur est survenue pendant le calcul. Modifiez une réponse ou rechargez la page.'
                : 'Complétez les champs signalés pour voir le détail.'}
            </p>
          </Callout>
        )}
      </div>

      {/* ── Compact live result (phones / tablets) ──────────────────────── */}
      {headline && comparison && !headlineVisible && (
        <div
          data-testid="live-bar"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-rule-strong bg-surface/95 px-4 py-2.5 shadow-[0_-4px_16px_rgb(0_0_0/0.08)] backdrop-blur lg:hidden"
        >
          <div className="mx-auto flex max-w-[var(--wrap)] items-center justify-between gap-3">
            {/* On a phone, while answering, the full headline is not on screen: this bar is then the
                one polite live region (never two at once). */}
            <div
              aria-live={phone && mobileView === 'form' ? 'polite' : undefined}
              aria-atomic="true"
              className="min-w-0 text-sm text-ink-2"
            >
              {phone && mobileView === 'form' && (
                <span className="sr-only" data-testid="headline-sentence">
                  {headlineSentence(comparison, committed.period)}
                </span>
              )}
              <p aria-hidden={phone && mobileView === 'form' ? 'true' : undefined}>
                <span className="block text-xs text-ink-3">Selon nos hypothèses</span>
                <span
                  className={cn(
                    'num text-lg font-bold',
                    headline.direction === 'gain' && 'text-gain',
                    headline.direction === 'loss' && 'text-loss',
                    headline.direction === 'flat' && 'text-ink',
                  )}
                >
                  {headline.direction === 'flat' ? '≈ 0 €/mois' : headline.amount}
                </span>{' '}
                {headline.direction !== 'flat' && (
                  <span className="text-ink-2">({headline.percent})</span>
                )}
              </p>
            </div>
            {mobileView === 'result' ? (
              <Button size="sm" variant="secondary" onClick={editAnswers} className="sm:hidden">
                Modifier
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="primary"
              onClick={seeDetail}
              className={cn(mobileView === 'result' && 'max-sm:hidden')}
            >
              Voir le détail
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ShareSection({ getUrl, children }: { getUrl: () => string; children: ReactNode }) {
  return (
    <section
      aria-labelledby="share-title"
      className="card flex flex-wrap items-center justify-between gap-4"
    >
      <div className="min-w-0 max-w-xl space-y-1">
        <h2 id="share-title" className="font-serif text-xl font-medium text-ink">
          Partager ce résultat
        </h2>
        <p className="text-sm text-ink-2">
          Le lien contient votre situation dans son adresse (après le « # »). Rien n’est envoyé à un
          serveur : seule la personne qui ouvre le lien la verra.
        </p>
        <p className="text-xs text-ink-3">{children}</p>
        <p className="pt-1 text-sm">
          <a href={withBase('/simulateur/cas-types/')}>
            Voir comment le plan touche d’autres foyers : qui gagne, qui perd ? →
          </a>
        </p>
      </div>
      <ShareButton getUrl={getUrl} variant="primary" />
    </section>
  );
}
