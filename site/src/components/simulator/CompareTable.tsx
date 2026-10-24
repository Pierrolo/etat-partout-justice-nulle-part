import { Fragment, useMemo, useState } from 'react';
import { SegmentedControl, TierBadge } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { ComponentGroup, Tier } from '@/lib/engine-types';
import { formatEuro, formatEuroDelta } from '@/lib/format';
import { GROUP_LABEL, GROUP_ORDER } from '@/lib/sim/result';
import type { ResultData } from '@/lib/sim/state';

const tone = (v: number) => (v > 0 ? 'text-gain' : v < 0 ? 'text-loss' : 'text-ink-3');

/** Phone-only sub-line: « 1 475 € → 1 655 € », replacing the two hidden numeric columns. */
function Fold({ before, after }: { before: string; after: string }) {
  return (
    <span className="mt-0.5 block text-xs font-normal text-ink-2 sm:hidden">
      <span className="sr-only">Aujourd’hui </span>
      <span className="num">{before}</span> <span aria-hidden="true">→</span>
      <span className="sr-only"> avec le plan </span> <span className="num">{after}</span>
    </span>
  );
}

/**
 * « Aujourd’hui » vs « Avec le plan », every component, monthly or annual.
 * Every amount comes from the engine's `roundForDisplay`: rounded to 5 € per month so that the rows add up
 * exactly to the totals and to the headline. The annual view is 12 × the monthly one (never re-rounded).
 * Indirect taxes (TVA…) come last, after a « avant impôts indirects » subtotal.
 */
export function CompareTable({ data }: { data: ResultData }) {
  const [annual, setAnnual] = useState(false);
  const { comparison, display } = data;
  const k = annual ? 12 : 1;
  const unit = annual ? 'par an' : 'par mois';
  const money = (v: number) => formatEuro(v * k);
  const delta = (v: number) => (v === 0 ? '—' : formatEuroDelta(v * k));

  const tierOf = useMemo(
    () => new Map(comparison.plan.components.map((c) => [c.id, c.tier as Tier])),
    [comparison],
  );
  const groups = GROUP_ORDER.map((g) => ({
    group: g as ComponentGroup,
    rows: display.lines.filter((r) => r.group === g),
  })).filter((g) => g.rows.length > 0);
  const hasIndirect = groups.some((g) => g.group === 'impots_indirects');

  const totalRow = (label: string, before: number, after: number, strong: boolean, key: string) => (
    <tr key={key} className={cn(strong && 'border-t-2 border-ink')}>
      <th
        scope="row"
        className={cn(strong ? 'text-base font-bold text-ink' : 'font-semibold text-ink')}
      >
        {label}
        <Fold before={money(before)} after={money(after)} />
      </th>
      <td
        data-numeric=""
        className={cn(
          'hidden sm:table-cell',
          strong ? 'text-base font-bold text-ink' : 'font-semibold text-ink',
        )}
      >
        {money(before)}
      </td>
      <td
        data-numeric=""
        className={cn(
          'hidden sm:table-cell',
          strong ? 'text-base font-bold text-ink' : 'font-semibold text-ink',
        )}
      >
        {money(after)}
      </td>
      <td
        data-numeric=""
        className={cn(strong ? 'text-base font-bold' : 'font-bold', tone(after - before))}
      >
        {delta(after - before)}
      </td>
    </tr>
  );

  return (
    <section aria-labelledby="table-title" className="card space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="space-y-1.5">
          <h3
            id="table-title"
            className="font-serif text-xl font-medium leading-snug tracking-tight text-ink sm:text-2xl"
          >
            Le tableau, aujourd’hui et avec le plan
          </h3>
          <p className="text-[0.9375rem] text-ink-2">
            Chaque composante de votre revenu disponible, {unit}, pour l’ensemble du ménage.
          </p>
        </div>
        <SegmentedControl
          legend="Période du tableau"
          hideLegend
          size="sm"
          options={[
            { value: 'mois', label: 'Par mois' },
            { value: 'an', label: 'Par an' },
          ]}
          value={annual ? 'an' : 'mois'}
          onChange={(v) => setAnnual(v === 'an')}
        />
      </header>

      <div
        role="region"
        aria-label="Tableau : revenu disponible aujourd’hui et avec le plan"
        tabIndex={0}
        className="max-w-full overflow-x-auto rounded-md border border-rule bg-surface"
      >
        {/* On phones the « Aujourd’hui » and « Avec le plan » columns fold into a sub-line under each
            label (same cells, still in the table): the € gap stays in its own column. */}
        <table className="data-table">
          <caption className="sr-only">
            Revenu disponible du ménage, aujourd’hui et avec le plan, {unit}, en euros, ligne par
            ligne
          </caption>
          <thead>
            <tr>
              <th scope="col">Ligne</th>
              <th scope="col" data-numeric="" className="hidden sm:table-cell">
                Aujourd’hui
              </th>
              <th scope="col" data-numeric="" className="hidden sm:table-cell">
                Avec le plan
              </th>
              <th scope="col" data-numeric="">
                Écart
              </th>
            </tr>
          </thead>
          {groups.map(({ group, rows }) => (
            <Fragment key={group}>
              {hasIndirect && group === 'impots_indirects' && (
                <tbody>
                  {totalRow(
                    'Revenu disponible avant impôts indirects',
                    display.baseline,
                    display.plan,
                    false,
                    'sub',
                  )}
                </tbody>
              )}
              <tbody>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={4}
                    className="bg-surface pt-4 text-xs font-bold uppercase tracking-wide text-ink-3"
                  >
                    {GROUP_LABEL[group]}
                  </th>
                </tr>
                {rows.map((r) => {
                  const tier = tierOf.get(r.id) ?? 'law';
                  return (
                    <tr key={r.id}>
                      <th scope="row" className="font-medium text-ink">
                        {r.label}
                        {tier !== 'law' && r.delta !== 0 && (
                          <TierBadge tier={tier} short size="sm" className="ms-2 align-middle" />
                        )}
                        <Fold before={money(r.before)} after={money(r.after)} />
                      </th>
                      <td data-numeric="" className="hidden text-ink-2 sm:table-cell">
                        {money(r.before)}
                      </td>
                      <td data-numeric="" className="hidden font-medium text-ink sm:table-cell">
                        {money(r.after)}
                      </td>
                      <td data-numeric="" className={cn('font-bold', tone(r.delta))}>
                        {delta(r.delta)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Fragment>
          ))}
          <tfoot>
            {totalRow(
              hasIndirect ? 'Revenu disponible après TVA estimée' : 'Revenu disponible',
              display.baselineAfterTva,
              display.planAfterTva,
              true,
              'total',
            )}
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-ink-3">
        Montants arrondis à 5 € par mois ; les lignes s’additionnent exactement aux totaux. Une
        ligne « — » ne change pas. Le revenu disponible est l’ensemble des revenus, moins les
        prélèvements, plus les prestations, en euros de 2026.
        {hasIndirect && ' Les impôts indirects sont une estimation (hypothèses H5 et TVA).'}
      </p>
    </section>
  );
}
