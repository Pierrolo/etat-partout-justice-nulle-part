import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Callout } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { Hypotheses, Period } from '@/lib/engine-types';
import {
  DEFAULT_HYP,
  emptyFormState,
  formToHousehold,
  hasExtras,
  householdToForm,
  missingLabels,
  stepOfError,
  STEPS,
  type FormState,
  type StepId,
} from '@/lib/sim/form';
import { useEngine } from '@/lib/sim/engine-lazy';
import { announcement, buildHeadline } from '@/lib/sim/result';
import { computeResult, sameState, type Committed } from '@/lib/sim/state';
import { EmptyResult, SideCard } from './Hero';
import { InputForm } from './InputForm';
import { focusField } from './focus';
import { type MoreHandle } from './MoreSections';
import { ResultView } from './ResultView';

const DEBOUNCE_MS = 250;
const STATE_HASH = /^#?v\d+\./;

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  el.focus({ preventScroll: true });
}

/** Clears the flag set by the inline script of the page (it hides the pre-rendered form behind a notice). */
function releaseSharedGuard() {
  document.documentElement.removeAttribute('data-sim-hash');
}

/**
 * The simulator island: questions (stepper on phones) → result in three layers.
 *
 *  - Nothing is pre-answered, and NO result is shown until every required question is answered: while the
 *    form is incomplete the result area says what is missing (never a stale or default figure).
 *  - Every input is controlled; the engine only runs on the DEBOUNCED, VALIDATED household. The engine is
 *    a lazily loaded chunk (`useEngine`): the questions need none of it.
 *  - State lives in the URL hash (`#v1.<base64url>`): restored on load / hashchange (through the same form
 *    validation as typed answers), written with `history.replaceState` after the first interaction. Never in
 *    the query string, never sent anywhere. Sharing builds the link from the CURRENT valid answers.
 */
export default function Simulator() {
  const engine = useEngine();
  const [form, setFormRaw] = useState<FormState>(emptyFormState);
  const [hyp, setHypRaw] = useState<Hypotheses>(DEFAULT_HYP);
  const [period, setPeriodRaw] = useState<Period>('steady');
  const [step, setStep] = useState(0);
  const [mobileView, setMobileView] = useState<'form' | 'result'>('form');
  const [affinerOpen, setAffinerOpen] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [hashNotice, setHashNotice] = useState<string | null>(null);
  const [shared, setShared] = useState(false);
  const [heroAbove, setHeroAbove] = useState(false);
  const [announce, setAnnounce] = useState('');
  const touched = useRef(false);
  const heroNode = useRef<HTMLDivElement | null>(null);
  const moreRef = useRef<MoreHandle | null>(null);

  const edited = useCallback(() => {
    touched.current = true;
    setShared(false);
  }, []);
  const setForm = useCallback(
    (u: (f: FormState) => FormState) => {
      edited();
      setFormRaw(u);
    },
    [edited],
  );
  const setHyp = useCallback(
    (h: Hypotheses) => {
      edited();
      setHypRaw(h);
    },
    [edited],
  );
  const setPeriod = useCallback(
    (p: Period) => {
      edited();
      setPeriodRaw(p);
    },
    [edited],
  );

  const parsed = useMemo(() => formToHousehold(form), [form]);
  /** The valid answers right now (not yet debounced); `null` while a required answer is missing. */
  const current = useMemo<Committed | null>(
    () => (parsed.household ? { household: parsed.household, hyp, period } : null),
    [parsed.household, hyp, period],
  );

  const [committed, setCommitted] = useState<Committed | null>(null);

  // Debounce valid states; an incomplete form clears the result at once (no stale figure on screen).
  useEffect(() => {
    if (!current) {
      setCommitted(null);
      return;
    }
    if (committed && sameState(current, committed)) return;
    const t = setTimeout(() => setCommitted(current), committed ? DEBOUNCE_MS : 0);
    return () => clearTimeout(t);
  }, [current, committed]);

  const computed = useMemo(
    () => (engine && committed ? computeResult(engine, committed) : null),
    [engine, committed],
  );
  const data = computed && computed.error === null ? computed : null;
  const stale = !!(current && committed && !sameState(current, committed));
  const computing = current !== null && data === null && computed?.error === undefined;

  // One short polite announcement per recomputation (the long sentence stays static text).
  useEffect(() => {
    setAnnounce(data ? announcement(data.comparison, data.display) : '');
  }, [data]);

  /* ── URL hash ─────────────────────────────────────────────────────────── */
  const latest = useRef({ current, committed });
  latest.current = { current, committed };

  /** The link for the CURRENT valid answers — never a stale or last-committed state. */
  const buildUrl = useCallback(() => {
    const c = latest.current.current ?? latest.current.committed;
    if (!c || !engine) return `${location.origin}${location.pathname}`;
    return `${location.origin}${location.pathname}#${engine.encodeState(c.household, c.hyp, c.period)}`;
  }, [engine]);

  const applyHash = useCallback(
    (hash: string): boolean => {
      if (!engine || !STATE_HASH.test(hash)) return false; // an in-page anchor such as #main: not ours
      const decoded = engine.decodeState(hash.replace(/^#/, ''));
      const fail = () => {
        setHashNotice('Ce lien ne semble pas complet : nous avons repris un formulaire vide.');
        return true;
      };
      if (!decoded) return fail();
      // The decoded household goes through the same validation as typed answers.
      const f = householdToForm(decoded.household);
      const check = formToHousehold(f);
      if (!check.household) return fail();
      setFormRaw(f);
      setHypRaw(decoded.hypotheses);
      setPeriodRaw(decoded.period);
      setCommitted({ household: check.household, hyp: decoded.hypotheses, period: decoded.period });
      setAffinerOpen(hasExtras(f));
      setMobileView('result');
      setStep(0);
      setHashNotice(null);
      setShared(true);
      touched.current = true;
      return true;
    },
    [engine],
  );

  // First application of a shared link, once the engine chunk is there.
  const appliedFirst = useRef(false);
  useEffect(() => {
    if (!engine || appliedFirst.current) return;
    appliedFirst.current = true;
    const had = applyHash(window.location.hash);
    releaseSharedGuard();
    if (had && window.innerWidth >= 640) requestAnimationFrame(() => scrollToId('resultat'));
  }, [engine, applyHash]);

  const writeHash = useCallback(() => {
    const c = latest.current.committed;
    if (!c || !engine) return;
    history.replaceState(
      null,
      '',
      `${location.pathname}${location.search}#${engine.encodeState(c.household, c.hyp, c.period)}`,
    );
  }, [engine]);

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
    if (touched.current && committed) writeHash();
  }, [committed, writeHash]);

  /* ── Layout ───────────────────────────────────────────────────────────── */
  const heroRef = useCallback((node: HTMLDivElement | null) => {
    heroNode.current = node;
  }, []);
  useEffect(() => {
    const el = heroNode.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setHeroAbove(false);
      return;
    }
    const io = new IntersectionObserver(([e]) => {
      if (e) setHeroAbove(!e.isIntersecting && e.boundingClientRect.top < 0);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [data, mobileView]);

  // Lets the page hide its title block on a phone once the result is open (see simulateur/index.astro).
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-sim-view', mobileView);
    return () => root.removeAttribute('data-sim-view');
  }, [mobileView]);

  const barVisible = !!data && !data.comparison.unsupported && heroAbove;
  // WCAG 2.4.11: a focused control is never hidden behind the compact result bar.
  useEffect(() => {
    if (!barVisible) return;
    const root = document.documentElement;
    const previous = root.style.scrollPaddingBottom;
    root.style.scrollPaddingBottom = '6rem';
    return () => {
      root.style.scrollPaddingBottom = previous;
    };
  }, [barVisible]);

  const editAnswers = useCallback((target?: StepId) => {
    setMobileView('form');
    setStep(target ? Math.max(0, STEPS.indexOf(target)) : 0);
    requestAnimationFrame(() => {
      if (target && window.innerWidth >= 640) {
        document
          .querySelector<HTMLElement>(`[data-step="${target}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else scrollToId('situation');
    });
  }, []);
  const seeResult = useCallback(() => {
    setMobileView('result');
    requestAnimationFrame(() => scrollToId('resultat'));
  }, []);
  const requestFocus = useCallback((key: string) => {
    setMobileView('form');
    setStep(STEPS.indexOf(stepOfError(key)));
    requestAnimationFrame(() => requestAnimationFrame(() => focusField(key)));
  }, []);
  const restart = useCallback(() => {
    touched.current = false;
    setFormRaw(emptyFormState());
    setHypRaw(DEFAULT_HYP);
    setPeriodRaw('steady');
    setCommitted(null);
    setShared(false);
    setShowErrors(false);
    setHashNotice(null);
    setMobileView('form');
    setStep(0);
    history.replaceState(null, '', `${location.pathname}${location.search}`);
    window.scrollTo({ top: 0 });
  }, []);

  const missing = useMemo(
    () =>
      Object.keys(parsed.errors).flatMap((key) => {
        const label = missingLabels({ [key]: parsed.errors[key]! })[0]!;
        return [{ key, label }];
      }),
    [parsed.errors],
  );
  const uniqueMissing = missing.filter((m, i, a) => a.findIndex((x) => x.label === m.label) === i);

  const unsupported = !!data?.comparison.unsupported;
  const sideHeadline = data && !unsupported ? buildHeadline(data.comparison, data.display) : null;

  const resultEmpty = (
    <EmptyResult
      missing={uniqueMissing}
      computing={computing}
      onFocusField={requestFocus}
      className="lg:hidden"
    />
  );

  return (
    <div className="wrap pb-24 lg:pb-16">
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </p>

      {hashNotice && (
        <div className="pb-6">
          <Callout tone="note" title="Lien incomplet">
            <p>{hashNotice}</p>
          </Callout>
        </div>
      )}

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
            showErrors={showErrors}
            onReveal={() => setShowErrors(true)}
            step={step}
            onStep={setStep}
            onFinish={seeResult}
            affinerOpen={affinerOpen}
          />
          {/* below the large breakpoint the sidebar is absent: say what is missing right under the form */}
          {!data && mobileView === 'form' && (
            <div className="mt-5 max-sm:hidden lg:hidden">{resultEmpty}</div>
          )}
        </div>

        {/* ── Live result (desktop sidebar) ─────────────────────────────── */}
        <aside aria-label="Résultat en direct" className="hidden lg:sticky lg:top-4 lg:block">
          {data && unsupported ? (
            <EmptyResultUnsupported />
          ) : data ? (
            <SideCard
              data={data}
              period={committed?.period ?? period}
              stale={stale}
              onSeeDetail={() => scrollToId('resultat')}
            />
          ) : (
            <EmptyResult
              missing={uniqueMissing}
              computing={computing}
              onFocusField={requestFocus}
            />
          )}
        </aside>
      </div>

      {/* ── The result: layer 1 « en clair », layer 2 « le détail », layer 3 « pour aller plus loin » ── */}
      <div
        id="resultat"
        tabIndex={-1}
        className={cn(
          'mt-6 outline-none sm:mt-12 lg:mt-14',
          mobileView === 'form' && 'max-sm:hidden',
          !data && 'lg:hidden',
        )}
      >
        {data && committed ? (
          <ResultView
            data={data}
            household={committed.household}
            hyp={committed.hyp}
            period={committed.period}
            stale={stale}
            shared={shared}
            getUrl={buildUrl}
            engineVersion={engine!.PARAMS_META.engineVersion}
            baselineYear={engine!.PARAMS_META.baselineYear}
            onEdit={editAnswers}
            onRestart={restart}
            onHyp={setHyp}
            onPickPeriod={(p) => {
              setPeriod(p);
              scrollToId('resultat');
            }}
            heroRef={heroRef}
            moreRef={moreRef}
          />
        ) : computed?.error ? (
          <Callout tone="note" title="Le calcul a échoué">
            <p>
              Une erreur est survenue pendant le calcul. Modifiez une réponse ou rechargez la page.
            </p>
          </Callout>
        ) : mobileView === 'result' ? (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => editAnswers()} className="sm:hidden">
              ← Modifier mes réponses
            </Button>
            <EmptyResult
              missing={uniqueMissing}
              computing={computing}
              onFocusField={requestFocus}
            />
          </div>
        ) : null}
      </div>

      {/* ── Compact result bar (phones / tablets), only once the headline has scrolled away ── */}
      {barVisible && sideHeadline && (
        <div
          data-testid="live-bar"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-rule-strong bg-surface/95 px-4 py-2.5 shadow-[0_-4px_16px_rgb(0_0_0/0.08)] backdrop-blur lg:hidden"
        >
          <div className="mx-auto flex max-w-[var(--wrap)] items-center justify-between gap-3">
            <p className="min-w-0 text-sm text-ink-2">
              <span className="block text-xs text-ink-3">{sideHeadline.basis}</span>
              <span
                className={cn(
                  'num text-lg font-bold',
                  sideHeadline.direction === 'gain' && 'text-gain',
                  sideHeadline.direction === 'loss' && 'text-loss',
                  sideHeadline.direction === 'flat' && 'text-ink',
                )}
              >
                {sideHeadline.direction === 'flat' ? '≈ 0 €/mois' : sideHeadline.amount}
              </span>
            </p>
            <Button size="sm" variant="secondary" onClick={() => editAnswers()}>
              Modifier mes réponses
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Sidebar text when the household is outside the model: no figure, an explanation. */
function EmptyResultUnsupported() {
  return (
    <div data-testid="side-unsupported" className="card space-y-2">
      <h2 className="eyebrow eyebrow-accent">Votre résultat</h2>
      <p className="font-serif text-xl font-medium text-ink">Pas encore couvert</p>
      <p className="text-[0.9375rem] text-ink-2">
        Le revenu d’un indépendant ou d’un gérant majoritaire n’est pas modélisé : aucun chiffre
        n’est affiché plutôt qu’un chiffre qui ne serait pas le vôtre.
      </p>
    </div>
  );
}
