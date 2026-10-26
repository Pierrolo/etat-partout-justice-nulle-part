import {
  sankey,
  sankeyLinkHorizontal,
  type SankeyLink as D3Link,
  type SankeyNode as D3Node,
} from 'd3-sankey';
import { useId, useMemo, useState } from 'react';
import { ChartFrame } from '@/components/ui/ChartFrame';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import type { ChipProps } from '@/lib/facts';
import { TIER_META } from '@/lib/tiers';
import { formatMdEuro, formatNumber } from '@/lib/format';
import type { SankeyLink, SankeyNode } from '@/lib/plan-data';
import { useWidth } from './useWidth';

type Horizon = 'an1' | 'pleine';

type N = SankeyNode & { id: string };
type L = SankeyLink;

const NARROW_NAMES: Record<string, string> = {
  structures: 'Structures',
  subventions: 'Subventions',
  niches: 'Niches',
  chomage: 'Chômage',
  patrimoine: 'Patrimoine',
  annee_1: 'Année 1',
  annee_pleine: 'Année pleine',
  salaire_net: 'Salaire net',
  capitalisation: 'Épargne',
};

const md = (v: number) => formatMdEuro(v, { decimals: v >= 100 ? 0 : 1 });
const TIER_WORD = {
  law: TIER_META.law.label.toLowerCase(),
  announced: TIER_META.announced.label.toLowerCase(),
} as const;

/** Break a label into lines of at most `max` characters, on spaces. */
function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of text.split(' ')) {
    if ((cur + ' ' + w).trim().length > max && cur) {
      out.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * The hero Sankey of the plan: where the 236 Md€ of yearly savings come from (left), when they
 * arrive (middle) and where they go (right): net pay (end of the CSG/CRDS) or personal savings.
 *
 * Tier encoding (never colour alone): the only flow written in the law (the CSG/CRDS returned to net pay)
 * is solid; every estimate of the authors is hatched. The workbook does not say which saving funds
 * which destination, so no category → destination link is drawn: the middle column avoids inventing one.
 */
export function PlanSankey({
  nodes,
  links,
  sources,
  total,
  year1,
}: {
  nodes: SankeyNode[];
  links: SankeyLink[];
  sources: ChipProps[];
  total: number;
  year1: number;
}) {
  const uid = useId().replace(/:/g, '');
  const [ref, width] = useWidth<HTMLDivElement>(900);
  const [horizon, setHorizon] = useState<Horizon>('pleine');
  const [sel, setSel] = useState<string | null>(null);

  const narrow = width < 560;
  const margin = narrow ? { t: 40, r: 78, b: 40, l: 82 } : { t: 46, r: 190, b: 44, l: 190 };
  const height = narrow ? 500 : 460;

  const view = useMemo(() => {
    const keepLink = (l: L) =>
      horizon === 'pleine' ? true : l.source !== 'annee_pleine' && l.target !== 'annee_pleine';
    const ls = links.filter(keepLink);
    const used = new Set(ls.flatMap((l) => [l.source, l.target]));
    const ns = nodes.filter((n) => used.has(n.id)).map((n) => ({ ...n }));
    const layout = sankey<N, L>()
      .nodeId((n) => n.id)
      .nodeAlign((n) => n.layer)
      .nodeSort(null)
      .nodeWidth(narrow ? 12 : 16)
      .nodePadding(narrow ? 12 : 18)
      .extent([
        [margin.l, margin.t],
        [Math.max(margin.l + 80, width - margin.r), height - margin.b],
      ]);
    return layout({ nodes: ns, links: ls.map((l) => ({ ...l })) });
    // `margin` and `height` are pure functions of `narrow`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horizon, width, narrow, nodes, links]);

  const gNodes = view.nodes as Array<D3Node<N, L> & N>;
  const gLinks = view.links as Array<D3Link<N, L> & L>;
  const path = sankeyLinkHorizontal<N, L>();
  const nodeById = new Map(gNodes.map((n) => [n.id, n]));
  const fmtName = (n: N) => (narrow ? (NARROW_NAMES[n.id] ?? n.short) : n.short);

  const idOf = (x: unknown) => (typeof x === 'object' && x !== null ? (x as N).id : String(x));
  const linkColor = (l: L) =>
    idOf(l.target) === 'salaire_net'
      ? 'var(--series-3)'
      : idOf(l.target) === 'capitalisation'
        ? 'var(--series-4)'
        : 'var(--series-other)';
  const active = (l: D3Link<N, L> & L) => !sel || idOf(l.source) === sel || idOf(l.target) === sel;

  const selNode = sel ? nodeById.get(sel) : null;
  const incoming = gLinks.filter((l) => idOf(l.target) === sel);
  const outgoing = gLinks.filter((l) => idOf(l.source) === sel);

  const tableRows = links.map((l) => ({
    de: nodes.find((n) => n.id === l.source)!.short,
    vers: nodes.find((n) => n.id === l.target)!.short,
    md: l.value,
    niveau: TIER_WORD[l.tier],
    cellule: l.cell,
  }));

  const sn = nodes.find((n) => n.id === 'salaire_net')!;
  const cap = nodes.find((n) => n.id === 'capitalisation')!;

  return (
    <div className="space-y-4">
      <div className="card bg-sunken">
        <SegmentedControl<Horizon>
          legend="Quel horizon ?"
          size="sm"
          value={horizon}
          onChange={(h) => {
            setHorizon(h);
            setSel(null);
          }}
          options={[
            { value: 'an1', label: 'Première année' },
            { value: 'pleine', label: 'Année pleine (régime de croisière)' },
          ]}
        />
      </div>

      <ChartFrame
        headingLevel={2}
        title={
          horizon === 'pleine'
            ? `${md(total)} d’économies par an, du budget vers votre salaire et votre épargne`
            : `Dès la première année : ${md(year1)} d’économies, dont ${md(sn.value)} rendus au salaire net`
        }
        subtitle="Milliards d’euros par an. Largeur du ruban = montant. Plein = proposé dans un amendement ; hachuré = annoncé."
        summary={
          horizon === 'pleine'
            ? `Selon le chiffrage du plan, cinq grandes économies (structures, subventions, niches, assurance chômage, rendement du patrimoine) atteignent ${md(total)} par an en régime de croisière. ${md(sn.value)} reviennent au salaire net par la fin de la CSG/CRDS sur les revenus d’activité : c’est la partie proposée dans un amendement. Le reste, ${md(cap.value)}, alimente une épargne personnelle dont le montant n’est inscrit nulle part.`
            : `La première année, ${md(year1)} d’économies financent d’abord les ${md(sn.value)} de CSG/CRDS rendus au salaire net ; ${md(year1 - sn.value)} restent pour l’épargne.`
        }
        sources={sources.map((s) => ({ ...s }))}
        table={{
          columns: [
            { key: 'de', label: 'De' },
            { key: 'vers', label: 'Vers' },
            {
              key: 'md',
              label: 'Md€ par an',
              numeric: true,
              format: (v) => formatNumber(Number(v), { decimals: 2 }),
            },
            { key: 'niveau', label: 'Niveau de preuve' },
            { key: 'cellule', label: 'Cellule du chiffrage' },
          ],
          rows: tableRows,
          caption: 'Flux du schéma du plan : des économies vers le salaire net et l’épargne',
        }}
        csvFileName="plan-sankey-236-md.csv"
        note="Le chiffrage donne les totaux par destination. Le schéma passe par une colonne « calendrier » (année 1, année pleine), sans inventer un lien économie par économie."
      >
        <div ref={ref}>
          <svg
            role="group"
            aria-label="Schéma de Sankey des économies du plan"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="block h-auto max-w-full overflow-visible"
          >
            <defs>
              {(['series-3', 'series-4', 'series-other'] as const).map((c) => (
                <pattern
                  key={c}
                  id={`${uid}-hatch-${c}`}
                  width="7"
                  height="7"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <rect width="7" height="7" fill={`var(--${c})`} fillOpacity="0.16" />
                  <rect width="2" height="7" fill={`var(--${c})`} fillOpacity="0.85" />
                </pattern>
              ))}
            </defs>

            {/* links */}
            <g fill="none">
              {gLinks.map((l, i) => {
                const col = linkColor(l);
                const key = col.replace('var(--', '').replace(')', '');
                return (
                  <path
                    key={i}
                    d={path(l) ?? ''}
                    stroke={l.tier === 'law' ? col : `url(#${uid}-hatch-${key})`}
                    strokeOpacity={
                      l.tier === 'law' ? (active(l) ? 0.62 : 0.12) : active(l) ? 1 : 0.2
                    }
                    strokeWidth={Math.max(1, l.width ?? 1)}
                  />
                );
              })}
            </g>

            {/* nodes */}
            {gNodes.map((n) => {
              const w = (n.x1 ?? 0) - (n.x0 ?? 0);
              const h = Math.max(2, (n.y1 ?? 0) - (n.y0 ?? 0));
              const isDest = n.layer === 2;
              const fill =
                n.id === 'salaire_net'
                  ? 'var(--series-3)'
                  : n.id === 'capitalisation'
                    ? `url(#${uid}-hatch-series-4)`
                    : n.layer === 1
                      ? 'var(--ink-2)'
                      : 'var(--ink-3)';
              const lines = wrap(fmtName(n), narrow ? 12 : 30);
              const x = n.layer === 0 ? (n.x0 ?? 0) - 8 : (n.x1 ?? 0) + 8;
              const cy = ((n.y0 ?? 0) + (n.y1 ?? 0)) / 2;
              const isSel = sel === n.id;
              return (
                <g key={n.id}>
                  <rect
                    x={n.x0}
                    y={n.y0}
                    width={w}
                    height={h}
                    rx={2}
                    fill={fill}
                    stroke={
                      n.id === 'capitalisation' ? 'var(--series-4)' : isSel ? 'var(--ink)' : 'none'
                    }
                    strokeWidth={n.id === 'capitalisation' || isSel ? 1.5 : 0}
                    tabIndex={0}
                    role="button"
                    aria-pressed={isSel}
                    aria-label={`${n.short} : ${md(n.value ?? 0)} par an, ${TIER_WORD[n.tier]}`}
                    className="cursor-pointer"
                    onClick={() => setSel(isSel ? null : n.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSel(isSel ? null : n.id);
                      }
                    }}
                  />
                  {n.layer === 1 ? (
                    <text
                      x={((n.x0 ?? 0) + (n.x1 ?? 0)) / 2}
                      y={n.id === 'annee_1' ? (n.y0 ?? 0) - 22 : (n.y1 ?? 0) + 18}
                      textAnchor="middle"
                      fontSize={narrow ? 12 : 13}
                    >
                      <tspan fontWeight="700" fill="var(--ink)">
                        {fmtName(n)}
                      </tspan>
                      <tspan x={((n.x0 ?? 0) + (n.x1 ?? 0)) / 2} dy="1.25em" fill="var(--ink-2)">
                        {md(n.value ?? 0)}
                      </tspan>
                    </text>
                  ) : (
                    <text
                      x={x}
                      y={cy}
                      textAnchor={n.layer === 0 ? 'end' : 'start'}
                      fontSize={narrow ? 12 : 13}
                      pointerEvents="none"
                    >
                      {lines.map((ln, i) => (
                        <tspan
                          key={i}
                          x={x}
                          dy={i === 0 ? `${-0.55 * lines.length + 0.35}em` : '1.2em'}
                          fontWeight="700"
                          fill="var(--ink)"
                        >
                          {ln}
                        </tspan>
                      ))}
                      <tspan x={x} dy="1.25em" fill="var(--ink-2)">
                        {md(n.value ?? 0)}
                      </tspan>
                      {isDest && !narrow && (
                        <tspan x={x} dy="1.25em" fontSize="12" fill="var(--ink-3)">
                          {TIER_WORD[n.tier]}
                        </tspan>
                      )}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <div
          aria-live="polite"
          className="mt-3 rounded-md bg-sunken p-3 text-[0.9375rem] text-ink-2 sm:p-4"
        >
          {selNode ? (
            <>
              <p className="font-semibold text-ink">
                {selNode.label}&#8239;: {md(selNode.value ?? 0)} par an{' '}
                <span className="font-normal text-ink-3">({TIER_WORD[selNode.tier]})</span>
              </p>
              {incoming.length > 0 && (
                <p className="mt-1">
                  Reçoit :{' '}
                  {incoming.map((l, i) => (
                    <span key={i}>
                      {nodeById.get(idOf(l.source))?.short} {md(l.value)}
                      {i < incoming.length - 1 ? ' · ' : '.'}
                    </span>
                  ))}
                </p>
              )}
              {outgoing.length > 0 && (
                <p className="mt-1">
                  Alimente :{' '}
                  {outgoing.map((l, i) => (
                    <span key={i}>
                      {nodeById.get(idOf(l.target))?.short} {md(l.value)}
                      {i < outgoing.length - 1 ? ' · ' : '.'}
                    </span>
                  ))}
                </p>
              )}
              {selNode.id === 'capitalisation' && (
                <p className="mt-1 text-sm text-ink-3">
                  Aucun montant n’est inscrit dans l’amendement pour ce compte d’épargne : il serait
                  fixé chaque année par la loi de finances.
                </p>
              )}
            </>
          ) : (
            <p>
              <span className="font-semibold text-ink">Touchez un bloc</span> pour voir ce qui entre
              et ce qui sort. Les rubans hachurés sont des annonces ; le ruban plein est proposé
              dans un amendement.
            </p>
          )}
        </div>
      </ChartFrame>
    </div>
  );
}
