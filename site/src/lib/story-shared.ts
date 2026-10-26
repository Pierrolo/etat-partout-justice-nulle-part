/**
 * Pure types and helpers shared by the story pages (server) and islands (client).
 * No JSON import here: the datasets are read in `story-data.ts` (build time only).
 */

export interface CofogNode {
  id: string;
  label: string;
  /** Md€, 2024. */
  value: number;
  /** 0 total · 1 groupe · 2 poste · 3 sous-fonction COFOG */
  level: number;
  /** Id of the level-1 group the node belongs to. */
  group: string;
  /** The book/pipeline had to infer which COFOG sub-functions form this line (DISCREPANCIES D03). */
  inferred?: boolean;
  cofogCode?: string;
  children?: CofogNode[];
}

/** Fixed group → categorical slot (colour follows the entity, never its rank). */
export const GROUP_SLOT: Record<string, number> = {
  secu_solidarite: 0,
  soutiens_sectoriels: 1,
  depenses_collectives: 2,
  enseignement_recherche: 3,
  securite: 4,
  dette: 5,
};

/** The book's own group labels (never renamed: « Sécurité » = défense + intérieur + justice). */
export const GROUP_SHORT: Record<string, string> = {
  secu_solidarite: 'Sécurité sociale et solidarité',
  soutiens_sectoriels: 'Soutiens sectoriels',
  depenses_collectives: 'Dépenses collectives',
  enseignement_recherche: 'Enseignement et recherche',
  securite: 'Sécurité',
  dette: 'Charge de la dette',
};

/** Flatten the tree (all levels) with parent labels, for the table and the CSV. */
export interface CofogRow extends Record<string, string | number | null> {
  niveau: string;
  poste: string;
  parent: string;
  valeur_md: number;
  part_pct: number;
}

export function cofogRows(tree: CofogNode): CofogRow[] {
  const rows: CofogRow[] = [];
  const LEVEL = ['Total', 'Groupe', 'Poste', 'Sous-fonction COFOG'];
  const walk = (n: CofogNode, parent: string) => {
    rows.push({
      niveau: LEVEL[n.level] ?? '',
      poste: n.cofogCode ? `${n.label} (${n.cofogCode})` : n.label,
      parent,
      valeur_md: n.value,
      part_pct: (n.value / tree.value) * 100,
    });
    n.children?.forEach((c) => walk(c, n.label));
  };
  walk(tree, '');
  return rows;
}

/**
 * « Si l'argent public était 100 € » — integer squares per group by largest remainder, so that the
 * 100 squares always add up exactly. Returns [groupId, squares, exactShare%] in the given order.
 */
export function squaresByGroup(
  groups: Array<{ id: string; value: number }>,
  total: number,
  squares = 100,
): Array<{ id: string; squares: number; exact: number }> {
  const exact = groups.map((g) => ({ id: g.id, exact: (g.value / total) * squares }));
  const base = exact.map((e) => Math.floor(e.exact));
  let left = squares - base.reduce((a, b) => a + b, 0);
  const order = exact
    .map((e, i) => ({ i, r: e.exact - Math.floor(e.exact) }))
    .sort((a, b) => b.r - a.r);
  for (const o of order) {
    if (left <= 0) break;
    base[o.i]! += 1;
    left -= 1;
  }
  return exact.map((e, i) => ({ id: e.id, squares: base[i]!, exact: e.exact }));
}

export interface EuroRow extends Record<string, string | number | boolean | null> {
  geo: string;
  name: string;
  isFrance: boolean;
  dep24: number | null;
  dep25: number | null;
  solde24: number | null;
  solde25: number | null;
  /** Revenu médian équivalent, € courants par an. */
  med: number | null;
  /** Même chose en standards de pouvoir d'achat (SPA). */
  spa: number | null;
}

export interface EuroAgg {
  dep24: number;
  solde24: number;
  med: number;
  spa: number;
}
