import { useEffect, useState } from 'react';
import { ChartFrame } from '@/components/ui/ChartFrame';
import type { ChipProps } from '@/lib/facts';
import { formatInteger } from '@/lib/format';
import type { MinistryDot, MinistryFate } from '@/lib/etat-shared';
import { prefersReducedMotion } from './useWidth';
import './story.css';

const FATE: Record<MinistryFate, { label: string; short: string }> = {
  garde: { label: 'Maintenus (un par bloc)', short: 'maintenu' },
  absorbe: { label: 'Absorbés dans le bloc d’un autre', short: 'absorbé dans le bloc d’un autre' },
  supprime: { label: 'Supprimés sans successeur', short: 'supprimé' },
};

/**
 * 35 ministères → 7. One dot per ministry; those that disappear fade out (supprimés sans successeur, plus
 * ceux absorbés dans le bloc d’un autre). The wording is always « 16 regroupés en 7 » = 7 maintenus + 9
 * absorbés: the same arithmetic everywhere (docs: DISCREPANCIES D29). The fade plays once when the chart
 * appears and is skipped with
 * `prefers-reduced-motion`; without JavaScript the final state is what is drawn.
 */
export function MinistryDots({
  dots,
  blocks,
  before,
  after,
  removedNet,
  removedOutright,
  regrouped,
  inferred,
  note,
  sources,
}: {
  dots: MinistryDot[];
  blocks: Array<{ id: string; label: string; merged: number }>;
  before: number;
  after: number;
  removedNet: number;
  removedOutright: number;
  regrouped: number;
  inferred: boolean;
  note: string;
  sources: ChipProps[];
}) {
  const [phase, setPhase] = useState<'final' | 'start'>('final');
  useEffect(() => {
    if (prefersReducedMotion()) return;
    setPhase('start');
    const t = window.setTimeout(() => setPhase('final'), 700);
    return () => window.clearTimeout(t);
  }, []);

  const counts = {
    garde: dots.filter((d) => d.fate === 'garde').length,
    absorbe: dots.filter((d) => d.fate === 'absorbe').length,
    supprime: dots.filter((d) => d.fate === 'supprime').length,
  };

  const faded = (f: MinistryFate) => f !== 'garde' && phase === 'final';
  const dotStyle = (d: MinistryDot, i: number) => {
    const base =
      d.fate === 'supprime'
        ? { background: 'var(--series-other)', border: '1.5px dashed var(--ink-3)' }
        : { background: 'var(--series-1)', border: '1.5px solid var(--series-1)' };
    return {
      ...base,
      opacity: faded(d.fate) ? 0.22 : 1,
      transition: 'opacity 900ms ease',
      transitionDelay: `${i * 18}ms`,
    };
  };

  return (
    <ChartFrame
      tier="announced"
      title={`${formatInteger(before)} ministères aujourd’hui, ${formatInteger(after)} demain`}
      subtitle="Un point = un ministère ou ministère délégué. Les points estompés disparaissent dans le plan."
      summary={`Sur ${formatInteger(before)} ministères, ${formatInteger(removedOutright)} sont supprimés sans successeur et ${formatInteger(regrouped)} sont regroupés en ${formatInteger(after)} blocs : ${formatInteger(after)} restent en tête de bloc et ${formatInteger(regrouped - after)} sont absorbés. En nombre net, ${formatInteger(removedNet)} ministères disparaissent.`}
      sources={sources.map((s) => ({ ...s }))}
      table={{
        columns: [
          { key: 'label', label: 'Ministère' },
          { key: 'sort', label: 'Sort dans le plan' },
          { key: 'bloc', label: 'Bloc d’accueil' },
        ],
        rows: dots.map((d) => ({
          label: d.label,
          sort: FATE[d.fate].short,
          bloc: blocks.find((b) => b.id === d.block)?.label ?? '',
        })),
        caption: `Les ${formatInteger(before)} ministères et leur sort`,
      }}
      csvFileName="ministeres-avant-apres.csv"
      note={
        inferred
          ? `Le classement en ${formatInteger(after)} blocs est déduit de la mise en page du graphique du livre : le classeur ne l’écrit pas. ${note}`
          : note
      }
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,22rem)_1fr] md:items-center">
        <div
          role="img"
          aria-label={`${formatInteger(before)} points : ${counts.garde} maintenus, ${counts.absorbe} regroupés, ${counts.supprime} supprimés`}
          className="mx-auto grid w-full max-w-[22rem] grid-cols-7 gap-2 sm:gap-2.5"
        >
          {dots.map((d, i) => (
            <span key={i} className="block aspect-square rounded-full" style={dotStyle(d, i)} />
          ))}
        </div>
        <ul className="space-y-2.5">
          {(['garde', 'absorbe', 'supprime'] as const).map((f) => (
            <li key={f} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-1.5 inline-block size-4 shrink-0 rounded-full"
                style={
                  f === 'supprime'
                    ? {
                        background: 'color-mix(in oklab, var(--series-other) 45%, transparent)',
                        border: '1.5px dashed var(--ink-3)',
                      }
                    : {
                        background:
                          f === 'garde'
                            ? 'var(--series-1)'
                            : 'color-mix(in oklab, var(--series-1) 30%, transparent)',
                        border: '1.5px solid var(--series-1)',
                      }
                }
              />
              <span>
                <span className="font-serif text-xl font-medium text-ink">
                  {formatInteger(counts[f])}
                </span>{' '}
                <span className="font-semibold text-ink">{FATE[f].label}</span>
              </span>
            </li>
          ))}
          <li className="text-sm text-ink-3">
            {formatInteger(regrouped)} ministères regroupés en {formatInteger(after)}&#8239;:{' '}
            {formatInteger(counts.garde)} maintenus + {formatInteger(counts.absorbe)} absorbés.
          </li>
        </ul>
      </div>

      <div className="mt-5 border-t border-rule pt-4">
        <p className="text-sm font-semibold text-ink">
          Les {formatInteger(after)} ministères qui resteraient, et combien de ministères chacun
          regroupe
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {blocks.map((b) => (
            <li
              key={b.id}
              className="rounded-full border border-rule-strong bg-surface px-3 py-1 text-[0.8125rem] text-ink-2"
            >
              <span className="font-semibold text-ink">{b.label}</span>
              {b.merged > 1 && (
                <span className="text-ink-3"> · {formatInteger(b.merged)} fusionnés</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </ChartFrame>
  );
}
