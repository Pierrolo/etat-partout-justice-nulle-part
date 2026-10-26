import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { NumberInput } from '@/components/ui/NumberInput';
import { SourceChip } from '@/components/ui/SourceChip';
import { TierBadge } from '@/components/ui/TierBadge';
import {
  bilanSentence,
  closeBand,
  closeRule,
  formatGuess,
  verdictFor,
  type Question,
  type ScaleQuestion,
} from '@/lib/questionnaire-model';
import { formatInteger } from '@/lib/format';
import { withBase } from '@/lib/site';

type Guess = number | string;

function ticks(q: ScaleQuestion): number[] {
  const f = 10 ** q.decimals;
  return [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round((q.min + (q.max - q.min) * t) * f) / f);
}

function axisLabel(q: ScaleQuestion, t: number): string {
  if (q.unit === 'count') return formatInteger(t);
  return formatGuess(q, t);
}

function guessLabel(q: Question, raw: Guess | undefined): string {
  if (raw === undefined) return 'pas de réponse';
  if (q.kind === 'choice') return q.options.find((o) => o.id === raw)?.label ?? 'pas de réponse';
  return typeof raw === 'number' ? formatGuess(q, raw) : 'pas de réponse';
}

function referenceLabel(q: Question): string {
  if (q.kind === 'scale') return q.truthLabel;
  return q.options.find((o) => o.id === q.correctId)?.label ?? '';
}

/**
 * One question at a time: a guess, then the sourced figure. Answers stay in memory for the
 * closing summary and are never written to storage. The same answers are in <noscript>.
 */
export function Questionnaire({ questions }: { questions: Question[] }) {
  const uid = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const skipFocus = useRef(true);
  const pendingAnswerFocus = useRef(false);
  const pendingFieldFocus = useRef(false);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [guesses, setGuesses] = useState<Record<string, Guess>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [needGuess, setNeedGuess] = useState(false);

  const total = questions.length;
  const current = questions[index];

  useEffect(() => {
    if (skipFocus.current) {
      skipFocus.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [index, done]);

  useEffect(() => {
    if (pendingAnswerFocus.current) {
      pendingAnswerFocus.current = false;
      answerRef.current?.focus();
    }
    // « Modifier » removes the focused button: put the focus back on the field (WCAG 2.4.3).
    if (pendingFieldFocus.current) {
      pendingFieldFocus.current = false;
      fieldRef.current
        ?.querySelector<HTMLElement>(
          'input[type="range"], input[type="radio"]:checked, input[type="radio"]',
        )
        ?.focus();
    }
  }, [open]);

  const restart = () => {
    setIndex(0);
    setDone(false);
    setGuesses({});
    setOpen({});
    setNeedGuess(false);
  };

  if (!current) return null;

  if (done) {
    const closes = questions.filter((q) => verdictFor(q, guesses[q.id])?.close).length;
    return (
      <div className="space-y-6" data-testid="questionnaire-bilan">
        <div className="space-y-2">
          <p className="eyebrow eyebrow-accent">Bilan</p>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="font-serif text-2xl font-medium tracking-tight text-ink focus:outline-3 focus:outline-offset-2 focus:outline-accent"
          >
            Où vous en étiez
          </h2>
          <p className="max-w-2xl text-[0.9375rem] leading-relaxed text-ink-2">
            {bilanSentence(closes, total)}
          </p>
          <p className="max-w-2xl text-sm leading-relaxed text-ink-3">{closeRule()}</p>
        </div>
        <ol className="space-y-3">
          {questions.map((q, i) => {
            const v = verdictFor(q, guesses[q.id]);
            return (
              <li key={q.id} className="card space-y-2 p-4">
                <p className="text-sm font-semibold leading-snug text-ink">
                  <span className="num text-ink-3">{i + 1}. </span>
                  {q.prompt}
                </p>
                <p className="text-[0.9375rem] leading-relaxed text-ink">
                  Vous : {guessLabel(q, guesses[q.id])}. {q.answerLead}
                  {' : '}
                  <span className={q.tier === 'announced' ? 'hatch px-1' : undefined}>
                    {referenceLabel(q)}
                  </span>
                  .
                </p>
                {v && <p className="text-sm text-ink-2">{v.text}</p>}
                <p className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                  <span className="font-semibold">Sources&nbsp;:</span>
                  {q.sources.map((src, k) => (
                    <SourceChip key={k} {...src} />
                  ))}
                </p>
                <a href={withBase(q.more.href)} className="text-sm font-semibold">
                  {q.more.label}
                </a>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap gap-3">
          <Button href={withBase('/comprendre/depenses/')}>Voir où va l’argent</Button>
          <Button href={withBase('/simulateur/')} variant="secondary">
            Calculer pour mon foyer
          </Button>
          <Button variant="ghost" onClick={restart}>
            Recommencer
          </Button>
        </div>
      </div>
    );
  }

  const revealed = open[current.id] === true;
  const guess = guesses[current.id];
  const verdict = revealed ? verdictFor(current, guess) : null;

  const reveal = () => {
    if (guess === undefined) {
      setNeedGuess(true);
      return;
    }
    setNeedGuess(false);
    pendingAnswerFocus.current = true;
    setOpen((s) => ({ ...s, [current.id]: true }));
  };

  const go = (next: number) => {
    setNeedGuess(false);
    if (next >= total) setDone(true);
    else setIndex(next);
  };

  return (
    <div className="space-y-4" data-testid="questionnaire" data-question={current.id}>
      <p className="text-sm font-semibold text-ink-2">
        Question {index + 1} sur {total}
      </p>
      <div className="h-1 overflow-hidden bg-sunken" aria-hidden="true">
        <div className="h-full bg-accent" style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>

      <div className="card space-y-5 border-[1.5px] border-accent bg-accent-soft p-5 sm:p-6">
        <div className="space-y-1.5">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="eyebrow eyebrow-accent">{current.eyebrow}</span>
            {current.tier && <TierBadge tier={current.tier} size="sm" />}
          </p>
          <h2
            id={`${uid}-q`}
            ref={headingRef}
            tabIndex={-1}
            className="font-serif text-xl font-medium leading-snug tracking-tight text-ink focus:outline-3 focus:outline-offset-2 focus:outline-accent sm:text-2xl"
          >
            {current.prompt}
          </h2>
          <p className="text-sm text-ink-2">{current.hint}</p>
        </div>

        <div ref={fieldRef}>
          {current.kind === 'scale' ? (
            <ScaleField
              key={current.id}
              q={current}
              uid={uid}
              guess={typeof guess === 'number' ? guess : null}
              revealed={revealed}
              onGuess={(n) => {
                setNeedGuess(false);
                if (n === null) {
                  setGuesses((s) => {
                    const next = { ...s };
                    delete next[current.id];
                    return next;
                  });
                } else {
                  setGuesses((s) => ({ ...s, [current.id]: n }));
                }
              }}
            />
          ) : (
            <div
              key={current.id}
              role="radiogroup"
              aria-labelledby={`${uid}-q`}
              className="space-y-2"
            >
              {current.options.map((opt) => (
                <label key={opt.id} className="block cursor-pointer">
                  <input
                    type="radio"
                    name={`${uid}-choice`}
                    value={opt.id}
                    className="peer sr-only"
                    checked={guess === opt.id}
                    disabled={revealed}
                    onChange={() => {
                      setNeedGuess(false);
                      setGuesses((s) => ({ ...s, [current.id]: opt.id }));
                    }}
                  />
                  <span className="flex min-h-11 items-center rounded-md border-[1.5px] border-rule-strong bg-field px-3.5 text-[0.9375rem] font-semibold text-ink peer-checked:border-accent peer-checked:bg-accent peer-checked:text-on-accent peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:opacity-70">
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {needGuess && (
          <p role="alert" className="text-sm font-semibold text-ink">
            Choisissez une estimation pour révéler la réponse.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {!revealed ? (
            <Button onClick={reveal}>Révéler la réponse</Button>
          ) : index < total - 1 ? (
            <Button onClick={() => go(index + 1)}>Question suivante</Button>
          ) : (
            <Button onClick={() => go(total)}>Voir le bilan</Button>
          )}
          {revealed && (
            <Button
              variant="secondary"
              onClick={() => {
                pendingFieldFocus.current = true;
                setOpen((s) => ({ ...s, [current.id]: false }));
              }}
            >
              Modifier
            </Button>
          )}
          {index > 0 && (
            <Button variant="ghost" onClick={() => go(index - 1)}>
              Question précédente
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {revealed && verdict && (
            <div
              ref={answerRef}
              tabIndex={-1}
              className="space-y-3 rounded-md bg-surface p-4 focus:outline-3 focus:outline-offset-2 focus:outline-accent"
            >
              <p
                className={
                  current.tier === 'announced'
                    ? 'hatch rounded-md border-[1.5px] border-dashed border-[var(--tier-announced-bd)] p-3 text-lg font-semibold leading-snug text-ink'
                    : 'text-lg font-semibold leading-snug text-ink'
                }
              >
                Vous avez dit {guessLabel(current, guess)}. {current.answerLead}
                {' : '}
                <span className="text-accent">{referenceLabel(current)}</span>.
              </p>
              <p className="text-[0.9375rem] text-ink-2">{verdict.text}</p>
              {current.body.map((p) => (
                <p key={p} className="text-[0.9375rem] leading-relaxed text-ink-2">
                  {p}
                </p>
              ))}
              {current.caveat && (
                <Callout tone={current.caveat.tone} title={current.caveat.title}>
                  <p>{current.caveat.text}</p>
                </Callout>
              )}
              <p className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                <span className="font-semibold">Sources&nbsp;:</span>
                {current.sources.map((s, i) => (
                  <SourceChip key={i} {...s} />
                ))}
              </p>
              <p className="flex flex-wrap gap-x-5 gap-y-1">
                <a href={withBase(current.more.href)} className="text-sm font-semibold">
                  {current.more.label}
                </a>
                {current.also && (
                  <a href={withBase(current.also.href)} className="text-sm font-semibold">
                    {current.also.label}
                  </a>
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      <noscript>
        <div className="space-y-6">
          {questions.map((q) => (
            <article key={q.id} className="space-y-2">
              <h2 className="text-xl text-ink">{q.prompt}</h2>
              <p className="text-[0.9375rem] text-ink">
                Réponse : {q.kind === 'scale' ? q.truthLabel : referenceLabel(q)}.
              </p>
              {q.body.map((p) => (
                <p key={p} className="text-[0.9375rem] leading-relaxed text-ink-2">
                  {p}
                </p>
              ))}
              {q.caveat && <p className="text-[0.9375rem] text-ink-2">{q.caveat.text}</p>}
              <p className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                <span className="font-semibold">Sources&nbsp;:</span>
                {q.sources.map((src, k) => (
                  <SourceChip key={k} {...src} />
                ))}
              </p>
            </article>
          ))}
        </div>
      </noscript>
    </div>
  );
}

function ScaleField({
  q,
  uid,
  guess,
  revealed,
  onGuess,
}: {
  q: ScaleQuestion;
  uid: string;
  guess: number | null;
  revealed: boolean;
  onGuess: (n: number | null) => void;
}) {
  const track = (v: number) => `${((v - q.min) / (q.max - q.min)) * 100}%`;
  const near = guess !== null && revealed && Math.abs(guess - q.truth) <= closeBand(q);
  const gapPct = guess === null ? 100 : (Math.abs(guess - q.truth) / (q.max - q.min)) * 100;
  const stack = revealed && guess !== null && !near && gapPct < 14;

  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-end">
      <div className="space-y-2">
        <label htmlFor={`${uid}-range`} className="text-[0.9375rem] font-semibold text-ink">
          Votre estimation : {guess === null ? 'pas encore choisie' : formatGuess(q, guess)}
        </label>
        <input
          id={`${uid}-range`}
          type="range"
          min={q.min}
          max={q.max}
          step={q.step}
          value={guess ?? q.min}
          disabled={revealed}
          aria-valuetext={
            guess === null
              ? 'pas encore choisie'
              : q.unit === '%'
                ? `${guess} pour cent`
                : q.unit === '€'
                  ? `${guess} euros`
                  : formatGuess(q, guess)
          }
          onChange={(e) => onGuess(Number(e.target.value))}
          className="h-11 w-full accent-[var(--accent)] disabled:opacity-60"
        />
        <div
          className={`relative mx-[0.55rem] text-xs text-ink-3 ${stack ? 'h-16' : 'h-9'}`}
          aria-hidden="true"
        >
          {ticks(q).map((t) => (
            <span
              key={t}
              className="num absolute top-0 -translate-x-1/2"
              style={{ left: track(t) }}
            >
              {axisLabel(q, t)}
            </span>
          ))}
          {revealed && guess !== null && (
            <>
              {near ? (
                <span
                  className="absolute top-4 -translate-x-1/2 rounded-full bg-accent px-2 py-0.5 text-[0.75rem] font-semibold text-on-accent"
                  style={{ left: track(q.truth) }}
                >
                  vous · {q.marker}
                </span>
              ) : (
                <>
                  <span
                    className="absolute top-4 -translate-x-1/2 rounded-full bg-ink px-2 py-0.5 text-[0.75rem] font-semibold text-paper"
                    style={{ left: track(guess) }}
                  >
                    vous
                  </span>
                  <span
                    className={`absolute -translate-x-1/2 rounded-full bg-accent px-2 py-0.5 text-[0.75rem] font-semibold text-on-accent ${stack ? 'top-10' : 'top-4'}`}
                    style={{ left: track(q.truth) }}
                  >
                    {q.marker}
                  </span>
                </>
              )}
            </>
          )}
        </div>
      </div>
      <NumberInput
        label={
          q.unit === '%'
            ? 'ou un pourcentage'
            : q.unit === '€'
              ? 'ou un montant en euros'
              : (q.entryLabel ?? 'ou un nombre')
        }
        unit={q.unit === 'count' ? undefined : q.unit}
        value={guess}
        onChange={(v) => onGuess(v === null ? null : Math.min(q.max, Math.max(q.min, v)))}
        min={q.min}
        max={q.max}
        step={q.step}
        decimals={q.decimals}
        disabled={revealed}
      />
    </div>
  );
}
