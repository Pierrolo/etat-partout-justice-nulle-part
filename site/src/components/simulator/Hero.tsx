import { Button } from '@/components/ui';
import { IconArrowDown, IconDown, IconUp } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import type { Period } from '@/lib/engine-types';
import { formatEuro } from '@/lib/format';
import { withBase } from '@/lib/site';
import { buildHeadline, pctSpoken, periodLong, prominentLosses } from '@/lib/sim/result';
import type { ResultData } from '@/lib/sim/state';
import { ShareButton } from './ShareButton';

const TONE = {
  gain: { text: 'text-gain', soft: 'bg-gain-soft', bar: 'bg-gain-mark' },
  loss: { text: 'text-loss', soft: 'bg-loss-soft', bar: 'bg-loss-mark' },
  flat: { text: 'text-ink', soft: 'bg-sunken', bar: 'bg-ink-3' },
} as const;

/** What the result area says before there is a result: never a number that could look like the reader's. */
export function EmptyResult({
  missing,
  computing,
  onFocusField,
  className,
}: {
  /** Short names of the unanswered questions (« votre âge »…), keyed by the field to focus. */
  missing: Array<{ key: string; label: string }>;
  /** The answers are complete: the calculation engine is still loading, or running. */
  computing: boolean;
  onFocusField: (key: string) => void;
  className?: string;
}) {
  return (
    <div data-testid="empty-result" className={cn('card flex flex-col gap-3', className)}>
      <h2 className="eyebrow eyebrow-accent">Votre résultat</h2>
      {computing ? (
        <p role="status" className="text-[0.9375rem] text-ink-2">
          Calcul en cours…
        </p>
      ) : (
        <>
          <p className="font-serif text-xl font-medium text-ink">
            Répondez aux questions pour voir votre résultat.
          </p>
          <p className="text-[0.9375rem] text-ink-2">
            Aucun chiffre n’apparaît tant que vous n’avez pas répondu : le simulateur ne part
            d’aucun profil par défaut.
          </p>
          {missing.length > 0 && (
            <div className="text-[0.9375rem] text-ink-2">
              <p className="font-semibold text-ink">Il reste à indiquer :</p>
              <ul className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
                {missing.slice(0, 6).map((m) => (
                  <li key={m.key}>
                    <button
                      type="button"
                      onClick={() => onFocusField(m.key)}
                      className="rounded-full border border-rule-strong px-2.5 py-0.5 text-sm font-medium text-ink hover:border-ink"
                    >
                      {m.label}
                    </button>
                  </li>
                ))}
                {missing.length > 6 && (
                  <li className="px-1 py-0.5 text-sm text-ink-3">et {missing.length - 6} autres</li>
                )}
              </ul>
            </div>
          )}
          <p className="text-sm">
            <a href={withBase('/simulateur/cas-types/')}>Voir d’abord des foyers types →</a>
          </p>
        </>
      )}
    </div>
  );
}

/** TNS, gérant majoritaire…: the engine says the result would not describe the household. */
export function UnsupportedResult({
  messages,
  className,
}: {
  messages: string[];
  className?: string;
}) {
  return (
    <div data-testid="unsupported-result" className={cn('card flex flex-col gap-3', className)}>
      <h2 className="eyebrow eyebrow-accent">Votre résultat</h2>
      <p className="font-serif text-xl font-medium text-ink">
        Pas encore couvert par le simulateur
      </p>
      {messages.map((m) => (
        <p key={m} className="text-[0.9375rem] text-ink-2">
          {m}
        </p>
      ))}
      <p className="text-[0.9375rem] text-ink-2">
        Plutôt que d’afficher un chiffre qui ne serait pas celui de votre foyer, nous n’en montrons
        aucun. Les foyers types donnent une idée de l’effet du plan sur d’autres situations.
      </p>
      <p className="text-sm">
        <a href={withBase('/simulateur/cas-types/')}>Voir des foyers types →</a>
      </p>
    </div>
  );
}

export interface HeroProps {
  data: ResultData;
  period: Period;
  /** The previous result stays on screen, dimmed, while a new one is computed. */
  stale: boolean;
  getUrl: () => string;
  shareText: string;
  onEdit: () => void;
  onResetPeriod: () => void;
}

/** THE sentence (docs/VISION.md §1), big: the figure, what it is after, and the two ends of the bar. */
export function Hero({ data, period, stale, getUrl, shareText, onEdit, onResetPeriod }: HeroProps) {
  const h = buildHeadline(data.comparison, data.display);
  const tone = TONE[h.direction];
  const Icon = h.direction === 'loss' ? IconDown : IconUp;
  const max = Math.max(h.baseline, h.plan, 1);
  return (
    <div
      data-testid="headline-hero"
      className="card flex flex-col gap-4"
      aria-busy={stale || undefined}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="eyebrow eyebrow-accent">Votre résultat</h2>
        {period !== 'steady' && (
          <button
            type="button"
            onClick={onResetPeriod}
            className="rounded-sm text-xs font-semibold text-ink-2 underline decoration-dotted underline-offset-4 hover:text-ink"
          >
            {periodLong(period)} · revenir au plan complet
          </button>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-base text-ink-2 sm:text-xl">
          {period === 'steady'
            ? 'Avec le plan complet, appliqué à votre situation de 2026, votre ménage aurait'
            : `En ${period}, avec les mesures alors en vigueur, appliquées à votre situation de 2026, votre ménage aurait`}
        </p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {h.direction !== 'flat' && (
            <span
              aria-hidden="true"
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-full',
                tone.soft,
                tone.text,
              )}
            >
              <Icon size={20} strokeWidth={2} />
            </span>
          )}
          <span
            data-key-figure
            data-testid="headline-figure"
            className={cn('stat-number text-[length:var(--text-display)]', tone.text)}
          >
            {h.direction === 'flat' ? '≈ 0 €' : h.amount.replace('/mois', '')}
          </span>
          <span className="font-serif text-lg text-ink-2 sm:text-xl">par mois</span>
          <span
            data-testid="headline-pct"
            className={cn('rounded-full px-2.5 py-1 text-sm font-bold', tone.soft, tone.text)}
          >
            <span aria-hidden="true">{h.percent}</span>
            <span className="sr-only">{h.pct === null ? pctSpoken(null) : h.percent}</span>
          </span>
        </p>
        <p className="text-[0.9375rem] text-ink-2">
          <strong className="font-semibold text-ink">{h.basis}</strong>
          {h.direction !== 'flat' && <> · {h.perDay.toLowerCase()}</>}
        </p>
        {h.pct === null && (
          <p className="text-sm text-ink-3">
            Pas de pourcentage : votre revenu d’aujourd’hui est presque nul, la variation relative
            n’aurait aucun sens.
          </p>
        )}
      </div>

      <dl className="space-y-2 text-sm" aria-label="Revenu disponible mensuel du ménage">
        {(
          [
            ['Aujourd’hui', h.baseline, 'bg-ink-3'],
            ['Avec le plan', h.plan, 'bg-accent'],
          ] as const
        ).map(([label, value, bg]) => (
          <div key={label} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3">
            <dt className="text-ink-2">{label}</dt>
            <dd className="contents">
              <span aria-hidden="true" className="h-2.5 rounded-full bg-sunken">
                <span
                  className={cn('block h-full rounded-full border border-transparent', bg)}
                  style={{ width: `${Math.max(2, (value / max) * 100)}%` }}
                />
              </span>
              <span className="num font-semibold text-ink">{formatEuro(value)}</span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-2 border-t border-rule pt-4">
        <ShareButton getUrl={getUrl} text={shareText} variant="primary" size="sm" />
        <Button variant="secondary" size="sm" onClick={onEdit}>
          Modifier mes réponses
        </Button>
      </div>
    </div>
  );
}

/** Compact live card of the desktop sidebar: the figure, what it is after, and a way down. */
export function SideCard({
  data,
  period,
  stale,
  onSeeDetail,
}: {
  data: ResultData;
  period: Period;
  stale: boolean;
  onSeeDetail: () => void;
}) {
  const h = buildHeadline(data.comparison, data.display);
  const tone = TONE[h.direction];
  const Icon = h.direction === 'loss' ? IconDown : IconUp;
  const important = prominentLosses(data.comparison).length;
  return (
    <div
      data-testid="headline-side"
      className={cn(
        'card flex flex-col gap-3 transition-opacity duration-200',
        stale && 'opacity-60',
      )}
      aria-busy={stale || undefined}
    >
      <h2 className="eyebrow eyebrow-accent">Votre résultat</h2>
      <p className="text-base text-ink-2">
        {period === 'steady'
          ? 'Avec le plan complet, votre ménage aurait'
          : `En ${period}, votre ménage aurait`}
      </p>
      <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        {h.direction !== 'flat' && (
          <span
            aria-hidden="true"
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full',
              tone.soft,
              tone.text,
            )}
          >
            <Icon size={18} strokeWidth={2} />
          </span>
        )}
        <span data-key-figure className={cn('stat-number text-[2.5rem]', tone.text)}>
          {h.direction === 'flat' ? '≈ 0 €' : h.amount.replace('/mois', '')}
        </span>
        <span className="font-serif text-lg text-ink-2">par mois</span>
        <span className={cn('rounded-full px-2.5 py-1 text-sm font-bold', tone.soft, tone.text)}>
          <span aria-hidden="true">{h.percent}</span>
          <span className="sr-only">{h.pct === null ? pctSpoken(null) : h.percent}</span>
        </span>
      </p>
      <p className="text-sm text-ink-2">{h.basis}</p>
      {important > 0 && (
        <p className="rounded-md bg-loss-soft px-3 py-2 text-sm text-ink">
          <strong className="font-semibold">À lire aussi :</strong>{' '}
          {important === 1
            ? '1 perte non chiffrée compte pour vous'
            : `${important} pertes non chiffrées comptent pour vous`}
          , sous le chiffre.
        </p>
      )}
      <Button variant="primary" size="sm" onClick={onSeeDetail} className="self-start">
        <IconArrowDown size={14} />
        Voir le résultat en clair
      </Button>
    </div>
  );
}
