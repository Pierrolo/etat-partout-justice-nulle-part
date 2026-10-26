/**
 * Slim, typed views of the dashboard datasets for the story pages. Pages call these in the Astro
 * frontmatter (build time) and pass the small result to React islands as props, so the big JSON
 * files (agences 675 Ko, niches 967 Ko…) never reach the browser.
 *
 * Every number here is read from the datasets produced by pipeline/ — nothing is typed by hand.
 */
import cofog from '@/data/depenses-cofog.json';
import type { CofogNode, EuroAgg, EuroRow } from './story-shared';

export * from './story-shared';

/* ── COFOG: spending by function ───────────────────────────────────────── */

type RawNode = {
  id: string;
  label_fr: string;
  value_md: number;
  level: number;
  cofog_code?: string | null;
  mapping_inferred?: boolean;
  children?: RawNode[];
};

function slimNode(n: RawNode, group: string): CofogNode {
  const g = n.level === 1 ? n.id : group;
  const kids = n.children?.map((c) => slimNode(c, g));
  return {
    id: n.id,
    label: n.label_fr,
    value: n.value_md,
    level: n.level,
    group: g,
    ...(n.mapping_inferred ? { inferred: true } : {}),
    ...(n.cofog_code ? { cofogCode: n.cofog_code } : {}),
    ...(kids && kids.length ? { children: kids } : {}),
  };
}

export function cofogTree(): CofogNode {
  return slimNode(cofog.tree as unknown as RawNode, 'total');
}

export const cofogMeta = {
  totalMd: cofog.meta.total_md,
  year: cofog.meta.year,
  source: cofog.meta.source,
  notes: cofog.meta.notes as string[],
  checks: cofog.checks,
};

/* ── Europe: comparisons (Eurostat, 2024) ─────────────────────────────── */

import europe from '@/data/europe.json';

export function europeData(): {
  rows: EuroRow[];
  ea20: EuroAgg;
  eu27: EuroAgg;
  datasets: Record<string, string>;
} {
  type P = (typeof europe.pays)[number];
  const rows: EuroRow[] = (europe.pays as P[]).map((p) => ({
    geo: p.geo,
    name: p.name_fr,
    isFrance: p.is_france,
    dep24: p.depenses_pib_2024 ?? null,
    dep25: p.depenses_pib_2025 ?? null,
    solde24: p.solde_pib_2024 ?? null,
    solde25: p.solde_pib_2025 ?? null,
    med: p.revenu_median_eur_2024 ?? null,
    spa: p.revenu_median_spa_2024 ?? null,
  }));
  const agg = (geo: string): EuroAgg => {
    const a = (europe.agregats as Array<Record<string, unknown>>).find((x) => x.geo === geo);
    if (!a) throw new Error(`europe.json: aggregate ${geo} missing`);
    return {
      dep24: a.depenses_pib_2024 as number,
      solde24: a.solde_pib_2024 as number,
      med: a.revenu_median_eur_2024 as number,
      spa: a.revenu_median_spa_2024 as number,
    };
  };
  return {
    rows,
    ea20: agg('EA20'),
    eu27: agg('EU27_2020'),
    datasets: europe.meta.source.datasets as Record<string, string>,
  };
}
