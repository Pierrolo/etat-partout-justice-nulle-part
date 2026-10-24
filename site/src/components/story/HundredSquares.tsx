import { useState } from 'react';
import { ChartFrame } from '@/components/ui/ChartFrame';
import type { ChipProps } from '@/lib/facts';
import { formatEuro, formatNumber } from '@/lib/format';
import { GROUP_SHORT, GROUP_SLOT, squaresByGroup, type CofogNode } from '@/lib/story-shared';
import './story.css';

/**
 * « Si l'argent public était 100 € » — a 10 × 10 unit chart: one square = 1 € of every 100 € spent.
 * Squares are allocated by largest remainder so there are exactly 100; the legend gives the exact
 * share. Tap or hover a legend line to isolate its squares (the numbers are in the legend anyway).
 */
export function HundredSquares({
  tree,
  sources,
  year,
}: {
  tree: CofogNode;
  sources: ChipProps[];
  year: number;
}) {
  const [active, setActive] = useState<string | null>(null);
  const groups = [...(tree.children ?? [])].sort((a, b) => b.value - a.value);
  const alloc = squaresByGroup(groups, tree.value);
  const cells = groups.flatMap((g, gi) => Array.from({ length: alloc[gi]!.squares }, () => g.id));

  const rows = groups.map((g, gi) => ({
    groupe: GROUP_SHORT[g.id] ?? g.label,
    euros_pour_100: (g.value / tree.value) * 100,
    cases: alloc[gi]!.squares,
  }));
  const top = groups[0]!;
  const secu = groups.find((g) => g.id === 'securite');

  return (
    <ChartFrame
      title="Si l’argent public était 100 €"
      subtitle={`Une case = 1 € sur 100 € de dépenses publiques en ${year}, par grande fonction.`}
      summary={`Sur 100 € dépensés, ${formatNumber((top.value / tree.value) * 100, { decimals: 0 })} € vont à « ${GROUP_SHORT[top.id] ?? top.label} » (${(top.children ?? []).map((p) => p.label.toLowerCase()).join(', ')})${
        secu
          ? ` et ${formatNumber((secu.value / tree.value) * 100, { decimals: 1 })} € à la sécurité (défense, police, justice)`
          : ''
      }.`}
      sources={sources.map((s) => ({ ...s }))}
      table={{
        columns: [
          { key: 'groupe', label: 'Fonction' },
          {
            key: 'euros_pour_100',
            label: 'Pour 100 €',
            numeric: true,
            format: (v) => formatEuro(Number(v), { decimals: 1 }),
          },
          { key: 'cases', label: 'Cases', numeric: true },
        ],
        rows,
        caption: 'Répartition de 100 € de dépenses publiques par fonction',
      }}
      csvFileName="depenses-publiques-pour-100-euros.csv"
      note="Cases arrondies à l’entier par la méthode du plus fort reste, pour faire exactement 100 ; la légende donne la part exacte."
    >
      <div className="grid gap-6 sm:grid-cols-[minmax(0,20rem)_1fr] sm:items-center">
        <div
          role="img"
          aria-label={`100 cases : ${groups.map((g, i) => `${alloc[i]!.squares} pour ${GROUP_SHORT[g.id] ?? g.label}`).join(', ')}`}
          className="unit-squares mx-auto w-full max-w-[20rem]"
          style={{ gridTemplateColumns: 'repeat(10, 1fr)' }}
          onMouseLeave={() => setActive(null)}
        >
          {cells.map((gid, i) => (
            <i
              key={i}
              style={{
                backgroundColor: `var(--series-${(GROUP_SLOT[gid] ?? 7) + 1})`,
                opacity: active && active !== gid ? 0.18 : 1,
                transition: 'opacity 150ms',
              }}
            />
          ))}
        </div>
        <ul className="space-y-1.5">
          {groups.map((g) => {
            const share = (g.value / tree.value) * 100;
            const posts = [...(g.children ?? [])].sort((a, b) => b.value - a.value);
            return (
              <li key={g.id}>
                <button
                  type="button"
                  aria-pressed={active === g.id}
                  onClick={() => setActive(active === g.id ? null : g.id)}
                  onMouseEnter={() => setActive(g.id)}
                  onFocus={() => setActive(g.id)}
                  onBlur={() => setActive(null)}
                  className="flex w-full cursor-pointer items-start gap-3 rounded-md p-2 text-start hover:bg-sunken aria-pressed:bg-sunken"
                >
                  <span
                    aria-hidden="true"
                    className="mt-1.5 size-3.5 shrink-0 rounded-[3px]"
                    style={{ backgroundColor: `var(--series-${(GROUP_SLOT[g.id] ?? 7) + 1})` }}
                  />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-serif text-xl font-medium text-ink">
                        {formatEuro(share, { decimals: share < 10 ? 1 : 0 })}
                      </span>
                      <span className="text-[0.9375rem] font-semibold text-ink">
                        {GROUP_SHORT[g.id] ?? g.label}
                      </span>
                    </span>
                    {posts.length > 1 && (
                      <span className="block text-[0.8125rem] leading-snug text-ink-3">
                        dont{' '}
                        {posts
                          .map(
                            (p) =>
                              `${p.label.replace(/ \(.*\)$/, '').toLowerCase()} ${formatNumber((p.value / tree.value) * 100, { decimals: 1 })} €`,
                          )
                          .join(' · ')}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </ChartFrame>
  );
}
