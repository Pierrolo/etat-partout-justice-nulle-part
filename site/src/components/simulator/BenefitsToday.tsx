import { Disclosure } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatEuro } from '@/lib/format';
import { plainText } from '@/lib/sim/result';
import type { ResultData } from '@/lib/sim/state';

/**
 * « Vos aides aujourd’hui »: the twelve benefits the simulator looks at, with their amount under today’s
 * law — and, for every one at 0 €, the rule that zeroed it (engine `baselineBenefitsExplained`), so
 * « 0 € » never reads as « forgotten ».
 */
export function BenefitsToday({ data }: { data: ResultData }) {
  const { comparison, display } = data;
  // the amounts on screen are the displayed ones (rounded to 5 €, adding up to the totals)
  const shown = new Map(display.lines.map((l) => [l.id, l.before]));
  const rows = comparison.baselineBenefitsExplained.map((b) => ({
    ...b,
    shown: b.amount >= 0.005 ? (shown.get(b.id) ?? Math.round(b.amount / 5) * 5) : 0,
  }));
  const paid = rows.filter((r) => r.amount >= 0.005);
  const zero = rows.filter((r) => r.amount < 0.005);

  return (
    <section aria-labelledby="aides-title" data-testid="benefits-today" className="card space-y-3">
      <h3 id="aides-title" className="font-serif text-xl font-medium text-ink sm:text-2xl">
        Vos aides aujourd’hui
      </h3>
      <p className="text-[0.9375rem] text-ink-2" data-testid="benefits-summary">
        {paid.length === 0 ? (
          <>Selon la loi d’aujourd’hui, le simulateur ne vous attribue aucune de ces aides.</>
        ) : (
          <>
            Selon la loi d’aujourd’hui, le simulateur vous attribue :{' '}
            {paid.map((r, i) => (
              <span key={r.id}>
                {i > 0 && (i === paid.length - 1 ? ' et ' : ', ')}
                <strong className="font-semibold text-ink">
                  {r.label.replace(/\s*\([^)]*\)\s*$/, '')} {formatEuro(r.shown)} par mois
                </strong>
              </span>
            ))}
            .
          </>
        )}{' '}
        {zero.length > 0 &&
          `${zero.length === 1 ? 'Une autre aide est' : `Les ${zero.length} autres aides sont`} à 0 € : la raison est donnée pour chacune.`}
      </p>
      <Disclosure
        variant="card"
        summary="Voir les 12 aides et leurs raisons"
        meta={`${paid.length} perçue${paid.length > 1 ? 's' : ''}`}
      >
        <ul className="divide-y divide-rule">
          {[...paid, ...zero].map((r) => (
            <li
              key={r.id}
              data-benefit={r.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 py-2.5"
            >
              <span className="font-medium text-ink">{r.label}</span>
              <span
                className={cn(
                  'num text-end font-bold',
                  r.amount >= 0.005 ? 'text-ink' : 'text-ink-3',
                )}
              >
                {formatEuro(r.shown)}
              </span>
              {r.reason && (
                <span className="col-span-2 text-sm text-ink-2">
                  Pourquoi 0 € : {plainText(r.reason)}.
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-3">
          Chaque aide est calculée à partir de vos réponses, comme le fait la CAF. Si le montant que
          vous touchez est différent, indiquez-le à l’étape « Vos aides ».
        </p>
      </Disclosure>
    </section>
  );
}
