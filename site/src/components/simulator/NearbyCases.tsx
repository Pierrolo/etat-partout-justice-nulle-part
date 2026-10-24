import { useMemo } from 'react';
import { IconDown, IconUp } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { CAS_TYPES, compare, encodeState, roundForDisplay } from '@/lib/engine';
import type { Comparison, Household, Hypotheses, Period } from '@/lib/engine-types';
import { formatEuro, formatEuroDelta } from '@/lib/format';
import { buildRows, householdIncome, type CaseRow } from '@/lib/sim/cas-types';
import { pctText } from '@/lib/sim/result';
import { withBase } from '@/lib/site';

const mainActivity = (h: Household) => h.adults[0].activity;

/** Distance between the household and a standard case: same composition, similar income. */
function distance(user: Household, userIncome: number, row: CaseRow): number {
  const h = row.cas.household;
  const income = Math.abs(Math.log((row.income + 300) / (userIncome + 300)));
  const adults = h.adults.length === user.adults.length ? 0 : 1;
  const kids = Math.abs(h.children.length - user.children.length) * 0.6;
  const activity = mainActivity(h) === mainActivity(user) ? 0 : 0.35;
  const tenure =
    (h.housing.status === 'locataire') === (user.housing.status === 'locataire') ? 0 : 0.2;
  return income + adults + kids + activity + tenure;
}

/**
 * « Foyers types proches du vôtre »: the three standard cases of « Qui gagne, qui perd ? » that look most
 * like this household (same composition, similar income), with their result. Illustrations, not statistics.
 */
export function NearbyCases({
  household,
  hypotheses,
  period,
  comparison,
}: {
  household: Household;
  hypotheses: Hypotheses;
  period: Period;
  comparison: Comparison;
}) {
  const rows = useMemo(() => {
    const all = buildRows(CAS_TYPES, { compare, roundForDisplay }, period, hypotheses);
    const income = householdIncome(comparison);
    return [...all]
      .map((r) => ({ r, d: distance(household, income, r) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
      .map((x) => x.r);
  }, [household, hypotheses, period, comparison]);

  const href = (r: CaseRow) =>
    `${withBase('/simulateur/')}#${encodeState(r.cas.household, hypotheses, period)}`;

  return (
    <section aria-labelledby="nearby-title" className="space-y-4">
      <header className="max-w-3xl space-y-1.5">
        <h4 id="nearby-title" className="font-serif text-xl font-medium text-ink sm:text-2xl">
          Des foyers types qui ressemblent au vôtre
        </h4>
        <p className="text-[0.9375rem] text-ink-2">
          Trois foyers de notre liste de cas types, choisis pour leur composition et leur revenu. Ce
          sont des exemples : ils ne disent pas combien de foyers se trouvent dans votre situation.
        </p>
      </header>
      <ul className="grid gap-3 md:grid-cols-3">
        {rows.map((r) => {
          const dir = r.delta > 0 ? 'gain' : r.delta < 0 ? 'loss' : 'flat';
          const Icon = dir === 'loss' ? IconDown : IconUp;
          return (
            <li
              key={r.id}
              data-testid="nearby-case"
              className="flex flex-col gap-2 rounded-lg border border-rule bg-surface p-4"
            >
              <p className="font-semibold text-ink">{r.label}</p>
              <p
                className={cn(
                  'flex items-center gap-1.5 font-serif text-2xl font-medium',
                  dir === 'gain' ? 'text-gain' : dir === 'loss' ? 'text-loss' : 'text-ink',
                )}
              >
                {dir !== 'flat' && <Icon size={16} strokeWidth={2} aria-hidden="true" />}
                <span className="num">{r.delta === 0 ? '≈ 0 €' : formatEuroDelta(r.delta)}</span>
                <span className="text-sm font-normal text-ink-2">par mois ({pctText(r.pct)})</span>
              </p>
              <p className="text-sm text-ink-2">
                {formatEuro(r.baseline)} aujourd’hui, {formatEuro(r.plan)} avec le plan.
              </p>
              <p className="mt-auto text-sm">
                <a href={href(r)}>Ouvrir ce foyer dans le simulateur →</a>
              </p>
            </li>
          );
        })}
      </ul>
      <p className="text-sm">
        <a href={withBase('/simulateur/cas-types/')}>
          Voir tous les foyers types : qui gagne, qui perd ? →
        </a>
      </p>
    </section>
  );
}
