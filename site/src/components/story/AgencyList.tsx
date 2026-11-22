import { useId, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { formatInteger } from '@/lib/format';
import {
  AGENCY_KIND,
  FATE_LABEL,
  unpackAgencies,
  type AgencyKind,
  type AgencyTuple,
  type FateGroup,
} from '@/lib/etat-shared';
import { toCsv } from '@/lib/csv';
import './story.css';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const FATE_COLOR: Record<FateGroup, string> = {
  suppression: 'var(--series-1)',
  cession: 'var(--series-4)',
  internalisation: 'var(--series-3)',
  autonomie: 'var(--series-other)',
};

const PAGE = 30;

/**
 * Searchable list of the named agencies of the workbook (operators, other bodies, authorities,
 * commissions) with their fate in the plan. Native form controls, results announced politely,
 * paginated (« Afficher plus »), CSV of the current selection.
 */
export function AgencyList({ packed }: { packed: AgencyTuple[] }) {
  const rows = useMemo(() => unpackAgencies(packed), [packed]);
  const uid = useId();
  const [q, setQ] = useState('');
  const [fate, setFate] = useState<FateGroup | 'all'>('all');
  const [kind, setKind] = useState<AgencyKind | 'all'>('all');
  const [shown, setShown] = useState(PAGE);

  const indexed = useMemo(() => rows.map((r) => ({ r, key: norm(r.n) })), [rows]);
  const results = useMemo(() => {
    const needle = norm(q.trim());
    return indexed
      .filter(
        ({ r, key }) =>
          (fate === 'all' || r.f === fate) &&
          (kind === 'all' || r.k === kind) &&
          (needle === '' || needle.split(/\s+/).every((w) => key.includes(w))),
      )
      .map((x) => x.r);
  }, [indexed, q, fate, kind]);

  const reset = () => setShown(PAGE);
  const download = () => {
    const csv = toCsv(
      [
        { key: 'nom', label: 'Nom' },
        { key: 'type', label: 'Type' },
        { key: 'sort', label: 'Sort dans le plan' },
      ],
      results.map((r) => ({ nom: r.n, type: AGENCY_KIND[r.k], sort: FATE_LABEL[r.f] })),
    );
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'agences-liste.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const field =
    'min-h-11 w-full rounded-md border-[1.5px] border-rule-strong bg-field px-3 text-[0.9375rem] text-ink';

  return (
    <div className="card space-y-4">
      <div>
        <h3 className="font-serif text-xl font-medium tracking-tight text-ink sm:text-2xl">
          Chercher une agence
        </h3>
        <p className="mt-1 text-[0.9375rem] text-ink-2">
          Les {formatInteger(rows.length)} lignes nommées dans le chiffrage publié. Certaines lignes
          regroupent plusieurs entités.
        </p>
      </div>

      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-q`} className="text-[0.9375rem] font-semibold text-ink">
            Nom ou mot-clé
          </label>
          <input
            id={`${uid}-q`}
            type="search"
            autoComplete="off"
            placeholder="Ex. : Météo, audiovisuel, logement"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              reset();
            }}
            className={field}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-f`} className="text-[0.9375rem] font-semibold text-ink">
            Sort dans le plan
          </label>
          <select
            id={`${uid}-f`}
            value={fate}
            onChange={(e) => {
              setFate(e.target.value as FateGroup | 'all');
              reset();
            }}
            className={field}
          >
            <option value="all">Tous</option>
            {(Object.keys(FATE_LABEL) as FateGroup[]).map((f) => (
              <option key={f} value={f}>
                {FATE_LABEL[f]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-k`} className="text-[0.9375rem] font-semibold text-ink">
            Type
          </label>
          <select
            id={`${uid}-k`}
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as AgencyKind | 'all');
              reset();
            }}
            className={field}
          >
            <option value="all">Tous</option>
            {(Object.keys(AGENCY_KIND) as AgencyKind[]).map((k) => (
              <option key={k} value={k}>
                {AGENCY_KIND[k]}
              </option>
            ))}
          </select>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-sm text-ink-2">
          <span className="font-semibold text-ink">{formatInteger(results.length)}</span>{' '}
          {results.length > 1 ? 'résultats' : 'résultat'}
        </p>
        <Button variant="secondary" size="sm" onClick={download} disabled={results.length === 0}>
          Télécharger la sélection (CSV)
        </Button>
      </div>

      {results.length === 0 ? (
        <p className="rounded-md bg-sunken p-4 text-[0.9375rem] text-ink-2">
          Aucune agence ne correspond. Essayez un mot plus court, ou retirez un filtre.
        </p>
      ) : (
        <ul className="divide-y divide-rule rounded-md border border-rule">
          {results.slice(0, shown).map((r, i) => (
            <li
              key={`${r.n}-${i}`}
              className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
            >
              <span className="min-w-0 text-[0.9375rem] text-ink">
                {r.n}
                {r.e ? <span className="text-ink-3"> · {formatInteger(r.e)} entités</span> : null}
                {r.x ? <span className="text-ink-3"> · {r.x}</span> : null}
              </span>
              <span className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-ink-2">
                <span className="text-ink-3">{AGENCY_KIND[r.k]}</span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                  <span
                    aria-hidden="true"
                    className="inline-block size-2.5 rounded-[3px]"
                    style={{ backgroundColor: FATE_COLOR[r.f] }}
                  />
                  {FATE_LABEL[r.f]}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {results.length > shown && (
        <div className="text-center">
          <Button variant="secondary" onClick={() => setShown((n) => n + PAGE * 2)}>
            Afficher plus ({formatInteger(results.length - shown)} restants)
          </Button>
        </div>
      )}
    </div>
  );
}
