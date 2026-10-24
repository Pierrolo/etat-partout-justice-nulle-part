import { IconAnnounced, IconHypothesis, IconLaw } from '@/components/ui/icons';
import { IconDown, IconUp } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import type { SummaryLine } from '@/lib/engine-types';
import { formatEuroDelta, roundForDisplay } from '@/lib/format';
import { certaintyParts, plainText } from '@/lib/sim/result';
import type { ResultData } from '@/lib/sim/state';

/** Amount shown for a summary line: the engine's displayed waterfall step when it matches, else 5 €. */
function shownAmount(line: SummaryLine, data: ResultData): number {
  const i = data.comparison.waterfall.findIndex((w) => w.delta === line.amount);
  return i >= 0 ? (data.display.waterfall[i]?.delta ?? 0) : roundForDisplay(line.amount, 5);
}

function Column({
  kind,
  title,
  lines,
  data,
}: {
  kind: 'gain' | 'loss';
  title: string;
  lines: SummaryLine[];
  data: ResultData;
}) {
  const Icon = kind === 'gain' ? IconUp : IconDown;
  return (
    <section
      aria-label={title}
      className={cn(
        'rounded-lg border-s-4 px-4 py-3',
        kind === 'gain' ? 'border-gain bg-gain-soft' : 'border-loss bg-loss-soft',
      )}
    >
      <h4
        className={cn(
          'flex items-center gap-2 text-base font-semibold',
          kind === 'gain' ? 'text-gain' : 'text-loss',
        )}
      >
        <Icon size={16} strokeWidth={2} aria-hidden="true" />
        {title}
      </h4>
      {lines.length === 0 ? (
        <p className="mt-1 text-[0.9375rem] text-ink-2">
          {kind === 'gain'
            ? 'Rien n’augmente pour votre foyer.'
            : 'Rien ne baisse pour votre foyer.'}
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {lines.map((l) => {
            const v = shownAmount(l, data);
            return (
              <li
                key={l.label}
                className="flex items-start justify-between gap-3 text-sm leading-snug sm:text-[0.9375rem]"
              >
                <span className="min-w-0 text-ink">{plainText(l.label)}</span>
                <span
                  className={cn(
                    'num shrink-0 font-bold',
                    kind === 'gain' ? 'text-gain' : 'text-loss',
                  )}
                >
                  {formatEuroDelta(v)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const CERTAINTY_ICON = {
  écrit: IconLaw,
  annoncé: IconAnnounced,
  estimé: IconHypothesis,
} as const;

/**
 * « En clair »: the engine's plain-French summary — one sentence, what goes up, what goes down, why,
 * and how sure each part is. Everything here is written by the engine (`comparison.summary`).
 */
export function EnClair({ data }: { data: ResultData }) {
  const s = data.comparison.summary;
  const cert = certaintyParts(s.certainty);
  return (
    <section aria-labelledby="enclair-title" data-testid="en-clair" className="card space-y-5">
      <h3 id="enclair-title" className="font-serif text-xl font-medium text-ink sm:text-2xl">
        En clair
      </h3>
      <p className="text-base leading-relaxed text-ink sm:text-[1.0625rem]">
        {plainText(s.sentence)}
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <Column kind="gain" title="Ce qui augmente" lines={s.gains} data={data} />
        <Column kind="loss" title="Ce qui baisse" lines={s.losses} data={data} />
      </div>

      <p className="text-sm leading-relaxed text-ink sm:text-[0.9375rem]">
        <strong className="font-semibold">Pourquoi ? </strong>
        {plainText(s.why)}
      </p>

      <div className="space-y-2 text-sm leading-snug text-ink-2 sm:text-[0.9375rem]">
        <p className="font-semibold text-ink">Ce qui est sûr, et ce qui ne l’est pas</p>
        <p>{plainText(cert.intro)}</p>
        {cert.items.length > 0 ? (
          <ul className="space-y-1.5">
            {cert.items.map((it) => {
              const key = Object.keys(CERTAINTY_ICON).find((k) => it.startsWith(k)) as
                keyof typeof CERTAINTY_ICON | undefined;
              const Icon = key ? CERTAINTY_ICON[key] : IconHypothesis;
              return (
                <li key={it} className="flex gap-2">
                  <Icon size={16} className="mt-1 shrink-0 text-ink-2" />
                  <span>{plainText(it.replace(/^./, (c) => c.toUpperCase()))}.</span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
