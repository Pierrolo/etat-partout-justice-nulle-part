import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { formatPercentPoints } from '@/lib/format';
import { GROUP_SHORT, GROUP_SLOT, type CofogNode } from '@/lib/story-shared';
import {
  UNIT_SUFFIX,
  allUnits,
  formatUnitBare,
  type Denominators,
  type UnitKey,
} from '@/lib/units';
import { layoutView, type Placed } from './treemapLayout';
import './story.css';

export interface CofogTreemapProps {
  tree: CofogNode;
  unit: UnitKey;
  den: Denominators;
  /** Name of the whole, for the breadcrumb root. */
  rootLabel?: string;
}

/** Find a node by walking an id path from the root. */
function walk(root: CofogNode, path: string[]): CofogNode[] {
  const chain = [root];
  let cur = root;
  for (const id of path) {
    const next = cur.children?.find((c) => c.id === id);
    if (!next) break;
    chain.push(next);
    cur = next;
  }
  return chain;
}

const pct = (v: number, total: number) =>
  formatPercentPoints((v / total) * 100, { decimals: v / total < 0.1 ? 1 : 0 });

const style = (p: Placed, slot: number): CSSProperties =>
  ({
    '--x': `${p.box.x}%`,
    '--y': `${p.box.y}%`,
    '--w': `${p.box.w}%`,
    '--h': `${p.box.h}%`,
    '--c': `var(--series-${slot + 1})`,
  }) as CSSProperties;

/** A node can be zoomed into when it has at least two non-empty children. */
const canDrill = (n: CofogNode) => (n.children?.filter((c) => c.value > 0).length ?? 0) > 1;

/**
 * Zoomable treemap of the 2024 public spending by function (COFOG). HTML tiles, positioned in % by
 * two precomputed layouts (desktop / phone): server-rendered, no measurement, readable without JS.
 *
 *  - area = amount; colour = the book's six groups (fixed slot per group, never by rank)
 *  - click / Enter on a block with a detail (or on a group title) zooms in; the breadcrumb zooms out
 *  - every block is a real button; the readout under the chart repeats the value in the four units,
 *    so nothing depends on hover. The « Tableau » tab holds the full numbers.
 */
export function CofogTreemap({
  tree,
  unit,
  den,
  rootLabel = 'Toutes les dépenses',
}: CofogTreemapProps) {
  const uid = useId();
  const [path, setPath] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const crumbRef = useRef<HTMLSpanElement>(null);
  const moved = useRef(false);

  // after zooming, keyboard focus would be lost (the button it was on disappears): park it on the
  // current breadcrumb, so Escape and « Remonter » keep working
  useEffect(() => {
    if (moved.current) crumbRef.current?.focus();
  }, [path]);

  const chain = useMemo(() => walk(tree, path), [tree, path]);
  const view = chain[chain.length - 1]!;
  const placed = useMemo(() => layoutView(view), [view]);
  const selected = selectedId ? findById(view, selectedId) : null;

  const zoomTo = (id: string) => {
    moved.current = true;
    const full = pathTo(view, id);
    if (full) setPath((p) => [...p, ...full]);
    setSelectedId(null);
  };
  const crumbTo = (depth: number) => {
    moved.current = true;
    setPath((p) => p.slice(0, depth));
    setSelectedId(null);
  };

  const onTile = (n: CofogNode) => {
    if (canDrill(n) && view.level < 2) zoomTo(n.id);
    else setSelectedId(n.id === selectedId ? null : n.id);
  };

  const readout = selected ?? (view.level > 0 ? view : null);

  return (
    <div
      className="hidden space-y-3 sm:block"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && path.length) crumbTo(path.length - 1);
      }}
    >
      <nav
        aria-label="Niveau affiché"
        className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm"
      >
        {chain.map((n, i) => {
          const last = i === chain.length - 1;
          return (
            <span key={n.id} className="flex items-center gap-1">
              {i > 0 && (
                <span aria-hidden="true" className="text-ink-3">
                  ›
                </span>
              )}
              {last ? (
                <span
                  ref={crumbRef}
                  tabIndex={-1}
                  aria-current="location"
                  className="px-1 font-semibold text-ink outline-offset-2"
                >
                  {i === 0 ? rootLabel : (GROUP_SHORT[n.id] ?? n.label)}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => crumbTo(i)}
                  className="min-h-8 cursor-pointer rounded-sm px-1 text-accent underline underline-offset-2 hover:text-accent-hover"
                >
                  {i === 0 ? rootLabel : (GROUP_SHORT[n.id] ?? n.label)}
                </button>
              )}
            </span>
          );
        })}
        {path.length > 0 && (
          <button
            type="button"
            onClick={() => crumbTo(path.length - 1)}
            className="btn btn-secondary btn-sm ms-auto"
          >
            <span aria-hidden="true">↑</span> Remonter
          </button>
        )}
      </nav>

      <div
        className="tm"
        role="group"
        aria-label={`Blocs proportionnels aux dépenses : ${view.label}`}
      >
        {placed.map((p) => {
          const n = p.node;
          const slot = GROUP_SLOT[n.group] ?? 7;
          const st = style(p, slot);
          // the visible text (name, then value) comes first in the accessible name: WCAG 2.5.3
          const shown = n.level === 1 ? (GROUP_SHORT[n.id] ?? n.label) : n.label;
          const valText = `${formatUnitBare(n.value, unit, den)}${UNIT_SUFFIX[unit]}`;
          const aria = `${shown} ${valText}. ${pct(n.value, view.value)} de ${view.level === 0 ? 'l’ensemble' : (GROUP_SHORT[view.id] ?? view.label)}${canDrill(n) && view.level < 2 ? '. Entrée pour zoomer.' : ''}`;
          if (p.grouped) {
            const drill = view.level < 2;
            return [
              <div key={`${n.id}-box`} className="tm-box" style={st} aria-hidden="true" />,
              <button
                key={`${n.id}-hd`}
                type="button"
                className="tm-hd"
                data-drill={drill && canDrill(n) ? 'true' : 'false'}
                style={st}
                aria-label={aria}
                onClick={() => (drill ? zoomTo(n.id) : onTile(n))}
              >
                <span className="tm-name">
                  {n.level === 1 ? (GROUP_SHORT[n.id] ?? n.label) : n.label}
                </span>{' '}
                <span className="tm-val">
                  {formatUnitBare(n.value, unit, den)}
                  {UNIT_SUFFIX[unit]}
                </span>
              </button>,
            ];
          }
          return (
            <button
              key={n.id}
              type="button"
              className="tm-t"
              style={st}
              data-drill={canDrill(n) && view.level < 2 ? 'true' : 'false'}
              data-label={p.fit.label ? '1' : '0'}
              data-value={p.fit.value ? '1' : '0'}
              aria-pressed={selectedId === n.id}
              aria-label={aria}
              onClick={() => onTile(n)}
            >
              <span className="tm-name">{n.label}</span>{' '}
              <span className="tm-val">
                {formatUnitBare(n.value, unit, den)}
                {UNIT_SUFFIX[unit]}
              </span>
            </button>
          );
        })}
      </div>

      <div
        id={`${uid}-readout`}
        aria-live="polite"
        className="min-h-[5.5rem] rounded-md bg-sunken p-3 text-[0.9375rem] sm:p-4"
      >
        {readout ? (
          <>
            <p className="font-semibold text-ink">
              {readout.label}
              {readout.cofogCode ? ` (COFOG ${readout.cofogCode})` : ''}
            </p>
            <p className="mt-0.5 text-ink-2">
              {pct(readout.value, tree.value)} des dépenses publiques. En{' '}
              {allUnits(readout.value, den).map((u, i, arr) => (
                <span key={u.unit}>
                  <span className="num font-semibold text-ink">{u.text}</span>{' '}
                  <span className="text-ink-3">{u.label.replace(/^(Md€|€) /, '')}</span>
                  {i < arr.length - 1 ? ' · ' : '.'}
                </span>
              ))}
            </p>
            {readout.inferred && (
              <p className="mt-1 text-xs text-ink-3">
                Ce poste regroupe des sous-fonctions COFOG rattachées par déduction arithmétique :
                voir l’onglet Sources.
              </p>
            )}
          </>
        ) : (
          <p className="text-ink-2">
            <span className="font-semibold text-ink">Touchez un bloc</span> pour son détail dans les
            quatre unités ; touchez le titre d’un groupe pour zoomer, puis « Remonter » pour
            revenir. La surface est proportionnelle au montant.
          </p>
        )}
      </div>
    </div>
  );
}

/** Ids to walk from `root` down to the node `id` (excluding root). */
function pathTo(root: CofogNode, id: string): string[] | null {
  for (const c of root.children ?? []) {
    if (c.id === id) return [c.id];
    const sub = pathTo(c, id);
    if (sub) return [c.id, ...sub];
  }
  return null;
}

function findById(root: CofogNode, id: string): CofogNode | null {
  if (root.id === id) return root;
  for (const c of root.children ?? []) {
    const f = findById(c, id);
    if (f) return f;
  }
  return null;
}
