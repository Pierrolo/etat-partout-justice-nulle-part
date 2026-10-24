import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { Hypotheses } from '@/lib/engine-types';
import { formatEuroDelta, roundForDisplay } from '@/lib/format';
import { withBase } from '@/lib/site';
import { Term } from '@/components/ui';
import type { ResultData } from '@/lib/sim/state';

type Reading = Hypotheses['H1_benefits'];

const READING: Record<Reading, { title: string; text: React.ReactNode }> = {
  replaced: {
    title: 'Remplacés par l’aide universelle',
    text: (
      <>
        Le RSA, la prime d’activité et l’AAH disparaissent : l’<Term id="afu">AFU</Term> les
        remplace, comme le disent les auteurs.
      </>
    ),
  },
  differential: {
    title: 'Maintenus, réduits de l’aide universelle',
    text: (
      <>
        Le RSA, la prime d’activité et l’AAH restent, mais l’aide universelle compte comme un revenu
        et ne laisse que la différence (<Term id="differentiel">différentiel</Term>).
      </>
    ),
  },
};

/**
 * Both readings of H1 side by side, when they differ for this household (engine `h1Alternative`):
 * the headline depends on a choice the amendments leave open, and the reader sees both numbers.
 */
export function H1Readings({
  data,
  current,
  onSwitch,
}: {
  data: ResultData;
  current: Reading;
  onSwitch: (r: Reading) => void;
}) {
  const alt = data.comparison.h1Alternative;
  if (!alt) return null;
  const other = alt.hypothesis;
  const items: Array<{ reading: Reading; delta: number; current: boolean }> = [
    { reading: current, delta: data.display.deltaAfterTva, current: true },
    { reading: other, delta: roundForDisplay(alt.deltaAfterTva, 5), current: false },
  ];
  // always the same order: « remplacés » first
  items.sort((a, b) => (a.reading === 'replaced' ? -1 : b.reading === 'replaced' ? 1 : 0));
  return (
    <section aria-labelledby="h1-title" data-testid="h1-readings" className="space-y-3">
      <header className="max-w-3xl space-y-1.5">
        <h3
          id="h1-title"
          className="font-serif text-xl font-medium leading-snug text-ink sm:text-2xl"
        >
          Ce chiffre dépend d’un choix
        </h3>
        <p className="text-[0.9375rem] text-ink-2">
          Les auteurs annoncent que l’aide universelle remplace certaines aides, mais aucun
          amendement ne les supprime. Pour votre foyer, les deux lectures ne donnent pas le même
          résultat :
        </p>
      </header>
      <ul className="grid gap-3 md:grid-cols-2">
        {items.map((it) => (
          <li
            key={it.reading}
            data-reading={it.reading}
            className={cn(
              'flex flex-col gap-2 rounded-lg border-[1.5px] p-4',
              it.current ? 'border-accent bg-accent-soft/50' : 'border-rule bg-surface',
            )}
          >
            <p className="flex flex-wrap items-center justify-between gap-2 font-semibold text-ink">
              {READING[it.reading].title}
              {it.current && (
                <span className="rounded-full border border-accent px-2 py-0.5 text-xs font-semibold text-accent">
                  Lecture retenue ici
                </span>
              )}
            </p>
            <p className="text-sm text-ink-2">{READING[it.reading].text}</p>
            <p className="mt-auto flex flex-wrap items-baseline gap-x-2">
              <span
                className={cn(
                  'num font-serif text-3xl font-medium',
                  it.delta > 0 ? 'text-gain' : it.delta < 0 ? 'text-loss' : 'text-ink',
                )}
              >
                {formatEuroDelta(it.delta)}
              </span>
              <span className="text-sm text-ink-2">par mois, après impôts, aides et TVA</span>
            </p>
            {!it.current && (
              <Button
                variant="secondary"
                size="sm"
                className="self-start"
                onClick={() => onSwitch(it.reading)}
              >
                Utiliser cette lecture
              </Button>
            )}
          </li>
        ))}
      </ul>
      <p className="text-sm">
        <a href={withBase('/methode/#h1')}>
          Pourquoi ce choix : hypothèse H1 sur la page Méthode →
        </a>
      </p>
    </section>
  );
}
