import { GROUP_SHORT, GROUP_SLOT, type CofogNode } from '@/lib/story-shared';
import { formatPercentPoints } from '@/lib/format';
import {
  UNIT_SUFFIX,
  formatUnitBare,
  formatUnit,
  type Denominators,
  type UnitKey,
} from '@/lib/units';

/**
 * Phone version of the spending chart: a ranked bar list, grouped by the book's six groups, each
 * line opening (native <details>, works without JavaScript) onto its COFOG sub-functions.
 * Bars share one baseline and one scale (the largest line = full width); values sit at the bar end.
 */
export function CofogBars({
  tree,
  unit,
  den,
}: {
  tree: CofogNode;
  unit: UnitKey;
  den: Denominators;
}) {
  const groups = [...(tree.children ?? [])].sort((a, b) => b.value - a.value);
  const maxPost = Math.max(...groups.flatMap((g) => (g.children ?? [g]).map((p) => p.value)));

  const bar = (v: number, slot: number, small = false) => (
    <span
      aria-hidden="true"
      className={`block rounded-e-[4px] ${small ? 'h-1.5' : 'h-2.5'}`}
      style={{
        width: `${Math.max(1.5, (v / maxPost) * 100)}%`,
        background: `var(--series-${slot + 1})`,
      }}
    />
  );

  return (
    <div className="space-y-6 sm:hidden">
      <p className="text-sm text-ink-2">
        Barres à la même échelle. <span className="font-semibold text-ink">Touchez un poste</span>{' '}
        pour ses fonctions COFOG.
      </p>
      {groups.map((g) => {
        const slot = GROUP_SLOT[g.id] ?? 7;
        const posts = [...(g.children ?? [])].sort((a, b) => b.value - a.value);
        return (
          <section key={g.id} aria-label={GROUP_SHORT[g.id] ?? g.label}>
            <h4
              className="flex items-baseline justify-between gap-3 border-t-[3px] pt-2 text-[0.9375rem] font-bold text-ink"
              style={{ borderColor: `var(--series-${slot + 1})` }}
            >
              <span>{GROUP_SHORT[g.id] ?? g.label}</span>
              <span className="num shrink-0 text-sm font-semibold text-ink-2">
                {formatUnit(g.value, unit, den)}
                <span className="font-normal text-ink-3">
                  {' · '}
                  {formatPercentPoints((g.value / tree.value) * 100, {
                    decimals: g.value / tree.value < 0.1 ? 1 : 0,
                  })}
                </span>
              </span>
            </h4>
            <ul className="mt-1">
              {posts.map((p) => {
                const subs = [...(p.children ?? [])]
                  .filter((c) => c.value > 0)
                  .sort((a, b) => b.value - a.value);
                const row = (
                  <>
                    <span className="flex items-baseline justify-between gap-3 text-[0.9375rem]">
                      <span className="min-w-0 text-ink">{p.label}</span>
                      <span className="num shrink-0 font-semibold text-ink">
                        {formatUnitBare(p.value, unit, den)}
                        <span className="text-xs font-normal text-ink-3">{UNIT_SUFFIX[unit]}</span>
                      </span>
                    </span>
                    {bar(p.value, slot)}
                  </>
                );
                return (
                  <li key={p.id} className="border-b border-rule last:border-b-0">
                    {subs.length > 1 ? (
                      <details className="group">
                        <summary className="flex min-h-11 cursor-pointer list-none flex-col justify-center gap-1 py-2 marker:content-none [&::-webkit-details-marker]:hidden">
                          {row}
                          <span className="text-xs text-accent group-open:hidden">
                            {subs.length} fonctions COFOG ▾
                          </span>
                          <span className="hidden text-xs text-accent group-open:inline">
                            Replier ▴
                          </span>
                        </summary>
                        <ul
                          className="mb-3 space-y-2 border-s-2 ps-3"
                          style={{ borderColor: `var(--series-${slot + 1})` }}
                        >
                          {subs.map((c) => (
                            <li key={c.id} className="space-y-1">
                              <span className="flex items-baseline justify-between gap-3 text-sm text-ink-2">
                                <span className="min-w-0">{c.label}</span>
                                <span className="num shrink-0 text-ink">
                                  {formatUnitBare(c.value, unit, den)}
                                  <span className="text-xs text-ink-3">{UNIT_SUFFIX[unit]}</span>
                                </span>
                              </span>
                              {bar(c.value, slot, true)}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : (
                      <div className="flex min-h-11 flex-col justify-center gap-1 py-2">{row}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
