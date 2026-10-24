import { useMemo, useState } from 'react';
import { Callout, ChartFrame, Disclosure, SegmentedControl, StatTile } from '@/components/ui';
import { IconDown, IconUp } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { csvDataUri, toCsv } from '@/lib/csv';
import { compare, DEFAULT_HYPOTHESES, encodeState, CAS_TYPES } from '@/lib/engine';
import type { Hypotheses, Period } from '@/lib/engine-types';
import {
  formatEuro,
  formatEuroDelta,
  formatInteger,
  formatNumber,
  formatPercent,
  roundForDisplay,
} from '@/lib/format';
import {
  buildRows,
  families,
  INCOME_BUCKETS,
  tileColor,
  tileStyle,
  type CaseRow,
} from '@/lib/sim/cas-types';
import { DISPLAY_STEP, PERIODS, percentDigits, periodLabel } from '@/lib/sim/result';
import { withBase } from '@/lib/site';
import { HypothesisControls } from './Hypotheses';

type Unit = 'eur' | 'pct';
type SortKey = 'order' | 'label' | 'income' | 'baseline' | 'plan' | 'delta' | 'pct';

const SOURCES = [{ label: 'Moteur de calcul du simulateur, foyers types', tier: 'law' as const }];

const pctText = (r: number) => formatPercent(r, { signed: true, decimals: percentDigits(r) });

export default function CasTypes() {
  const [period, setPeriod] = useState<Period>('steady');
  const [hyp, setHyp] = useState<Hypotheses>(DEFAULT_HYPOTHESES);
  const [unit, setUnit] = useState<Unit>('eur');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'order',
    dir: 'asc',
  });
  const [active, setActive] = useState<string | null>(null);

  const rows = useMemo(() => buildRows(CAS_TYPES, compare, period, hyp), [period, hyp]);
  const fams = useMemo(() => families(rows), [rows]);
  const usedBuckets = useMemo(
    () => INCOME_BUCKETS.filter((b) => rows.some((r) => r.bucket === b.id)),
    [rows],
  );

  const value = (r: CaseRow) => (unit === 'eur' ? r.delta : r.pct);
  const maxAbs = Math.max(1e-9, ...rows.map((r) => Math.abs(value(r))));
  const gains = rows.filter((r) => r.delta > 0).length;
  const losses = rows.filter((r) => r.delta < 0).length;
  const flat = rows.length - gains - losses;
  const href = (r: CaseRow) =>
    `${withBase('/simulateur/')}#${encodeState(r.cas.household, hyp, period)}`;
  /** Tile text: the unit « € » is dropped on phones (the legend says « € par mois ») to keep four digits on one line. */
  const label = (r: CaseRow) =>
    unit === 'eur' ? (
      <>
        {formatNumber(r.delta, { signed: true })}
        <span className="hidden sm:inline">&nbsp;€</span>
      </>
    ) : (
      pctText(r.pct)
    );

  const bestRow = rows.reduce((b, r) => (r.delta > b.delta ? r : b), rows[0]!);
  const worstRow = rows.reduce((b, r) => (r.delta < b.delta ? r : b), rows[0]!);
  const activeRow = rows.find((r) => r.id === active) ?? null;

  const sorted = useMemo(() => {
    const idx = new Map(rows.map((r, i) => [r.id, i]));
    const k = sort.key;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const c =
        k === 'order'
          ? idx.get(a.id)! - idx.get(b.id)!
          : k === 'label'
            ? a.label.localeCompare(b.label, 'fr')
            : (a[k] as number) - (b[k] as number);
      return c * dir || idx.get(a.id)! - idx.get(b.id)!;
    });
  }, [rows, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'label' ? 'asc' : 'desc' },
    );

  const csv = csvDataUri(
    toCsv(
      [
        { key: 'label', label: 'Foyer type' },
        { key: 'family', label: 'Famille' },
        { key: 'income', label: 'Revenu net avant prestations (€/mois)' },
        { key: 'baseline', label: 'Aujourd’hui (€/mois)' },
        { key: 'plan', label: 'Avec le plan (€/mois)' },
        { key: 'delta', label: 'Écart (€/mois)' },
        { key: 'pct', label: 'Écart (ratio)' },
      ],
      rows.map((r) => ({
        label: r.label,
        family: r.family,
        income: Math.round(r.income),
        baseline: r.baseline,
        plan: r.plan,
        delta: r.delta,
        pct: Number(r.pct.toFixed(4)),
      })),
    ),
  );

  return (
    <div className="wrap space-y-8 pb-16">
      <Callout tone="announced" title="Des cas types, pas la population">
        <p>
          Ces foyers sont des exemples choisis pour illustrer des situations courantes. Ce n’est pas
          un échantillon représentatif : nous ne savons pas combien de foyers se trouvent dans
          chaque situation. On ne peut donc pas en déduire la part des ménages qui gagnent ou
          perdent.
        </p>
      </Callout>

      {/* one filter row above everything it scopes */}
      <div className="card space-y-4">
        <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
          <SegmentedControl
            legend="Période"
            size="sm"
            options={PERIODS.map((p) => ({ value: String(p), label: periodLabel(p) }))}
            value={String(period)}
            onChange={(v) => setPeriod(v === 'steady' ? 'steady' : (Number(v) as Period))}
          />
          <SegmentedControl
            legend="Afficher l’écart en"
            size="sm"
            options={[
              { value: 'eur', label: '€ par mois' },
              { value: 'pct', label: '% du revenu' },
            ]}
            value={unit}
            onChange={setUnit}
          />
        </div>
        <Disclosure summary="Changer les hypothèses" meta="H1 · H2 · H5 · TVA">
          <HypothesisControls value={hyp} onChange={setHyp} idPrefix="ct" />
        </Disclosure>
      </div>

      <ul className="grid gap-4 sm:grid-cols-3" aria-label="Bilan des foyers types">
        <StatTile
          as="li"
          tone="gain"
          label="Foyers types qui gagnent"
          value={formatInteger(gains)}
          unit={`sur ${formatInteger(rows.length)}`}
          reframe="Revenu disponible plus élevé qu’aujourd’hui."
        />
        <StatTile
          as="li"
          tone="loss"
          label="Foyers types qui perdent"
          value={formatInteger(losses)}
          unit={`sur ${formatInteger(rows.length)}`}
          reframe="Revenu disponible plus bas qu’aujourd’hui."
        />
        <StatTile
          as="li"
          label="Foyers types sans écart notable"
          value={formatInteger(flat)}
          unit={`sur ${formatInteger(rows.length)}`}
          reframe={`Moins de ${formatEuro(DISPLAY_STEP)} d’écart par mois.`}
        />
      </ul>

      <ChartFrame
        headingLevel={2}
        title="Qui gagne, qui perd ?"
        subtitle={`Écart de revenu disponible par foyer type (${period === 'steady' ? 'plan complet' : period}). Chaque case est un foyer : touchez-la pour l’ouvrir dans le simulateur.`}
        summary={
          <>
            Sur {formatInteger(rows.length)} foyers types, {formatInteger(gains)} gagnent,{' '}
            {formatInteger(losses)} perdent et {formatInteger(flat)} ne changent pas sensiblement.
            Le plus fort gain est pour « {bestRow.label} » ({formatEuroDelta(bestRow.delta)} par
            mois), la plus forte perte pour « {worstRow.label} » ({formatEuroDelta(worstRow.delta)}{' '}
            par mois). Ce sont des cas types, pas une estimation de la population.
          </>
        }
        sources={SOURCES}
        note="Revenu net : salaires, pensions et allocation chômage du ménage, avant impôt et avant prestations. Montants arrondis à 5 € près."
      >
        <div className="space-y-4">
          <Legend max={maxAbs} unit={unit} />

          <div role="group" aria-label="Carte des foyers types, par famille et niveau de revenu">
            {/* column headers */}
            <div
              className="grid gap-1.5 pb-1.5 md:grid-cols-[minmax(9rem,13rem)_1fr]"
              aria-hidden="true"
            >
              <span className="hidden text-xs font-semibold text-ink-3 md:block">
                Famille ↓ · Revenu net du ménage →
              </span>
              <div
                className="grid gap-1.5"
                style={{ gridTemplateColumns: `repeat(${usedBuckets.length}, minmax(0, 1fr))` }}
              >
                {usedBuckets.map((b) => (
                  <span
                    key={b.id}
                    className="text-center text-[0.6875rem] font-semibold leading-tight text-ink-3 sm:text-xs"
                  >
                    {b.label}
                  </span>
                ))}
              </div>
            </div>

            <ul className="divide-y divide-rule border-y border-rule">
              {fams.map((f) => (
                <li
                  key={f}
                  className="grid gap-x-1.5 gap-y-1.5 py-2 md:grid-cols-[minmax(9rem,13rem)_1fr] md:items-center"
                >
                  <p className="text-sm font-semibold text-ink">{f}</p>
                  <div
                    className="grid gap-1.5"
                    style={{ gridTemplateColumns: `repeat(${usedBuckets.length}, minmax(0, 1fr))` }}
                  >
                    {usedBuckets.map((b) => {
                      const cell = rows.filter((r) => r.family === f && r.bucket === b.id);
                      return (
                        <div key={b.id} className="flex min-w-0 flex-col gap-1.5">
                          {cell.length === 0 ? (
                            <span
                              aria-hidden="true"
                              className="flex h-11 items-center justify-center rounded-md text-ink-3/60"
                            >
                              ·
                            </span>
                          ) : (
                            cell.map((r) => {
                              const v = value(r);
                              const t = Math.max(-1, Math.min(1, v / maxAbs));
                              const sty = tileStyle(tileColor(t));
                              const Icon = v < 0 ? IconDown : IconUp;
                              return (
                                <a
                                  key={r.id}
                                  href={href(r)}
                                  data-testid="cas-tile"
                                  data-delta={r.delta}
                                  aria-label={`${r.label}, revenu net ${formatEuro(roundForDisplay(r.income, DISPLAY_STEP))} par mois : ${
                                    r.delta === 0
                                      ? 'pas d’écart'
                                      : `${formatEuroDelta(r.delta)} par mois, ${pctText(r.pct)}`
                                  }. Ouvrir dans le simulateur.`}
                                  onMouseEnter={() => setActive(r.id)}
                                  onFocus={() => setActive(r.id)}
                                  onMouseLeave={() => setActive(null)}
                                  onBlur={() => setActive(null)}
                                  style={sty}
                                  className="flex min-h-11 min-w-0 flex-col items-center justify-center rounded-md border border-[color-mix(in_srgb,currentColor_22%,transparent)] px-1 py-1 text-center text-[0.8125rem] font-bold leading-tight no-underline outline-offset-2 hover:border-ink hover:no-underline hover:[color:inherit] focus-visible:outline-3 focus-visible:outline-accent sm:text-sm"
                                >
                                  <span className="num inline-flex items-center gap-0.5 whitespace-nowrap">
                                    {r.delta !== 0 && (
                                      <Icon
                                        size={11}
                                        strokeWidth={2.25}
                                        className="hidden shrink-0 sm:inline"
                                      />
                                    )}
                                    {label(r)}
                                  </span>
                                </a>
                              );
                            })
                          )}
                        </div>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p
            className="min-h-[3.25rem] rounded-md bg-sunken px-3.5 py-2.5 text-sm text-ink-2"
            aria-hidden="true"
          >
            {activeRow ? (
              <>
                <span className="font-semibold text-ink">{activeRow.label}</span> · revenu net{' '}
                {formatEuro(roundForDisplay(activeRow.income, DISPLAY_STEP))} par mois :{' '}
                {formatEuro(activeRow.baseline)} aujourd’hui, {formatEuro(activeRow.plan)} avec le
                plan ({formatEuroDelta(activeRow.delta)}).
              </>
            ) : (
              'Survolez ou parcourez une case au clavier pour lire le détail du foyer. Le tableau ci-dessous donne les mêmes chiffres.'
            )}
          </p>
        </div>
      </ChartFrame>

      <section aria-labelledby="ct-table-title" className="card space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 id="ct-table-title" className="font-serif text-xl font-medium text-ink sm:text-2xl">
              Le détail, foyer par foyer
            </h2>
            <p className="text-[0.9375rem] text-ink-2">
              Triez en cliquant sur un titre de colonne. Le nom d’un foyer ouvre le simulateur avec
              sa situation.
            </p>
          </div>
          <a href={csv} download="foyers-types.csv" className="btn btn-secondary btn-sm">
            Télécharger (CSV)
          </a>
        </header>
        <div
          role="region"
          aria-label="Tableau : foyers types, revenu disponible aujourd’hui et avec le plan"
          tabIndex={0}
          className="max-w-full overflow-x-auto rounded-md border border-rule bg-surface"
        >
          <table className="data-table min-w-[44rem]">
            <caption className="sr-only">
              Foyers types : revenu net, revenu disponible aujourd’hui et avec le plan, écart
            </caption>
            <thead>
              <tr>
                <Th sortKey="label" sort={sort} onSort={toggleSort}>
                  Foyer type
                </Th>
                <Th sortKey="income" sort={sort} onSort={toggleSort} numeric>
                  Revenu net
                </Th>
                <Th sortKey="baseline" sort={sort} onSort={toggleSort} numeric>
                  Aujourd’hui
                </Th>
                <Th sortKey="plan" sort={sort} onSort={toggleSort} numeric>
                  Avec le plan
                </Th>
                <Th sortKey="delta" sort={sort} onSort={toggleSort} numeric>
                  Écart (€/mois)
                </Th>
                <Th sortKey="pct" sort={sort} onSort={toggleSort} numeric>
                  Écart (%)
                </Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id}>
                  <th scope="row" className="font-medium">
                    <a href={href(r)}>{r.label}</a>
                  </th>
                  <td data-numeric="">{formatEuro(roundForDisplay(r.income, DISPLAY_STEP))}</td>
                  <td data-numeric="">{formatEuro(r.baseline)}</td>
                  <td data-numeric="">{formatEuro(r.plan)}</td>
                  <td
                    data-numeric=""
                    className={cn(
                      'font-bold',
                      r.delta > 0 ? 'text-gain' : r.delta < 0 ? 'text-loss' : 'text-ink-3',
                    )}
                  >
                    {r.delta === 0 ? '—' : formatEuroDelta(r.delta)}
                  </td>
                  <td
                    data-numeric=""
                    className={cn(
                      'font-bold',
                      r.delta > 0 ? 'text-gain' : r.delta < 0 ? 'text-loss' : 'text-ink-3',
                    )}
                  >
                    {r.delta === 0 ? '—' : pctText(r.pct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Th({
  sortKey,
  sort,
  onSort,
  numeric,
  children,
}: {
  sortKey: SortKey;
  sort: { key: SortKey; dir: 'asc' | 'desc' };
  onSort: (k: SortKey) => void;
  numeric?: boolean;
  children: React.ReactNode;
}) {
  const on = sort.key === sortKey;
  return (
    <th
      scope="col"
      data-numeric={numeric ? '' : undefined}
      aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-sm font-semibold hover:text-ink"
      >
        {children}
        <span
          aria-hidden="true"
          className={cn('text-[0.625rem]', on ? 'text-ink' : 'text-ink-3/50')}
        >
          {on ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}

function Legend({ max, unit }: { max: number; unit: Unit }) {
  const end = (v: number) =>
    unit === 'eur' ? formatEuroDelta(roundForDisplay(v, DISPLAY_STEP)) : pctText(v);
  return (
    <div className="max-w-md space-y-1" aria-hidden="true">
      <div
        className="h-2.5 rounded-full"
        style={{
          background:
            'linear-gradient(90deg, var(--div-loss-4), var(--div-loss-3), var(--div-loss-2), var(--div-loss-1), var(--div-mid), var(--div-gain-1), var(--div-gain-2), var(--div-gain-3), var(--div-gain-4))',
        }}
      />
      <div className="flex justify-between text-xs font-semibold text-ink-2">
        <span className="text-loss">{end(-max)} · perd</span>
        <span>0</span>
        <span className="text-gain">gagne · {end(max)}</span>
      </div>
    </div>
  );
}
