import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { NumberInput } from '@/components/ui/NumberInput';
import { SourceChip } from '@/components/ui/SourceChip';
import type { ChipProps } from '@/lib/facts';
import { formatEuro, formatMdEuro, formatNumber, formatPercentPoints } from '@/lib/format';

export interface PredictRevealProps {
  /** Real share, in % (6,36). */
  truthPct: number;
  totalMd: number;
  groupMd: number;
  foyers: number;
  /** Authors' sentence, verbatim. */
  quote: string;
  year: number;
  sources: ChipProps[];
  quoteSource: ChipProps;
}

/**
 * Predict, then reveal (the spirit of the NYT « You draw it »), built to be operable without a pointer:
 * a native range input (keyboard: arrows, Home/End, PageUp/PageDown) AND a numeric field kept in sync —
 * so no gesture is ever required (WCAG 2.5.7) — and a plain « Révéler » button. Nothing animates.
 * The answer also sits in <noscript>, so the page is complete without JavaScript.
 */
export function PredictReveal({
  truthPct,
  totalMd,
  groupMd,
  foyers,
  quote,
  year,
  sources,
  quoteSource,
}: PredictRevealProps) {
  const uid = useId();
  const [guess, setGuess] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  const perYear = (groupMd * 1e9) / foyers;
  const perDay = perYear / 365;
  const truth = formatPercentPoints(truthPct, { decimals: 1 });

  const verdict = (() => {
    if (guess === null) return null;
    const gap = guess - truthPct;
    if (Math.abs(gap) <= 1.5) return 'Très proche de la réalité.';
    if (gap > 0)
      return `C’est ${formatNumber(guess / truthPct, { decimals: guess / truthPct < 10 ? 1 : 0 })} fois plus que la réalité.`;
    return `C’est ${formatNumber(truthPct / Math.max(guess, 0.1), { decimals: 1 })} fois moins que la réalité.`;
  })();

  const track = (v: number) => `${Math.min(100, Math.max(0, v))}%`;

  return (
    <div className="card space-y-5 border-[1.5px] border-accent bg-accent-soft" data-predict>
      <div className="space-y-1.5">
        <p className="eyebrow eyebrow-accent">À vous de deviner</p>
        <h3 className="font-serif text-xl font-medium leading-snug tracking-tight text-ink sm:text-2xl">
          À votre avis, quelle part des dépenses publiques va à la sécurité : police, justice,
          défense ?
        </h3>
        <p className="text-sm text-ink-2">
          Répondez en pourcentage des {formatMdEuro(totalMd)} dépensés en {year}. Aucune réponse
          n’est enregistrée.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_11rem] sm:items-end">
        <div className="space-y-2">
          <label htmlFor={`${uid}-range`} className="text-[0.9375rem] font-semibold text-ink">
            Votre estimation :{' '}
            {guess === null ? 'pas encore choisie' : formatPercentPoints(guess, { decimals: 0 })}
          </label>
          <input
            id={`${uid}-range`}
            type="range"
            min={0}
            max={100}
            step={1}
            value={guess ?? 50}
            disabled={revealed}
            aria-valuetext={guess === null ? 'pas encore choisie' : `${guess} pour cent`}
            onChange={(e) => setGuess(Number(e.target.value))}
            className="h-11 w-full accent-[var(--accent)] disabled:opacity-60"
          />
          {/* the scale, with both markers once revealed */}
          <div className="relative mx-[0.55rem] h-9 text-xs text-ink-3" aria-hidden="true">
            {[0, 25, 50, 75, 100].map((t) => (
              <span
                key={t}
                className="num absolute top-0 -translate-x-1/2"
                style={{ left: track(t) }}
              >
                {t}
                {' %'}
              </span>
            ))}
            {revealed && (
              <>
                {guess !== null && (
                  <span
                    className="absolute top-4 -translate-x-1/2 rounded-full bg-ink px-2 py-0.5 text-[0.75rem] font-semibold text-paper"
                    style={{ left: track(guess) }}
                  >
                    vous
                  </span>
                )}
                <span
                  className="absolute top-4 -translate-x-1/2 rounded-full bg-accent px-2 py-0.5 text-[0.75rem] font-semibold text-on-accent"
                  style={{ left: track(truthPct) }}
                >
                  réalité
                </span>
              </>
            )}
          </div>
        </div>
        <NumberInput
          label="ou tapez un nombre"
          unit="%"
          value={guess}
          onChange={(v) => setGuess(v === null ? null : Math.min(100, Math.max(0, v)))}
          min={0}
          max={100}
          step={1}
          disabled={revealed}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {!revealed ? (
          <Button onClick={() => setRevealed(true)}>Révéler la réponse</Button>
        ) : (
          <Button
            variant="secondary"
            onClick={() => {
              setRevealed(false);
              setGuess(null);
            }}
          >
            Recommencer
          </Button>
        )}
      </div>

      <div aria-live="polite" className="space-y-3">
        {revealed && (
          <div className="space-y-3 rounded-md bg-surface p-4">
            <p className="text-lg font-semibold leading-snug text-ink">
              {guess !== null && <>Vous avez dit {formatPercentPoints(guess, { decimals: 0 })}. </>}
              La réalité : <span className="text-accent">{truth}</span>.
            </p>
            {verdict && <p className="text-[0.9375rem] text-ink-2">{verdict}</p>}
            <p className="text-[0.9375rem] leading-relaxed text-ink-2">
              {truth} de {formatMdEuro(totalMd)}, c’est {formatMdEuro(groupMd)} :{' '}
              {formatEuro(perYear)} par foyer et par an, soit {formatEuro(perDay, { decimals: 2 })}{' '}
              par foyer et par jour, sur {formatNumber(foyers / 1e6, { decimals: 1 })} millions de
              foyers (le dénominateur du livre).
            </p>
            <p className="text-[0.9375rem] leading-relaxed text-ink-2">
              Les auteurs en font un argument : « {quote} ». À vous de juger si c’est peu.
            </p>
            <p className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
              <span className="font-semibold">Sources&nbsp;:</span>
              {sources.map((s, i) => (
                <SourceChip key={i} {...s} />
              ))}
              <SourceChip {...quoteSource} />
            </p>
          </div>
        )}
      </div>

      <noscript>
        <p className="rounded-md bg-surface p-4 text-[0.9375rem] text-ink">
          Réponse : la sécurité (défense, police, justice) représente {truth} des dépenses
          publiques, soit {formatMdEuro(groupMd)}, ou {formatEuro(perYear)} par foyer et par an.
        </p>
      </noscript>
    </div>
  );
}
