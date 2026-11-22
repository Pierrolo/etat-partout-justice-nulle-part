/** Pure types and labels shared by the server-side views (etat-data.ts) and the client islands. No JSON here. */

export type MinistryFate = 'garde' | 'absorbe' | 'supprime';
export interface MinistryDot {
  label: string;
  fate: MinistryFate;
  /** Block (the future ministry) it belongs to, if any. */
  block: string | null;
}

export type FateGroup = 'suppression' | 'cession' | 'internalisation' | 'autonomie';
export const FATE_LABEL: Record<FateGroup, string> = {
  suppression: 'Suppression',
  cession: 'Cession d’actif',
  internalisation: 'Internalisation dans un ministère',
  autonomie: 'Autonomie maintenue',
};

export interface FateCount {
  id: FateGroup;
  n: number;
  /** Where these agencies come from (operators, other bodies, authorities, commissions). */
  parts: Array<{ label: string; n: number }>;
}

export const AGENCY_KIND = {
  op: 'Opérateur de l’État',
  hp: 'Organisme hors budget de l’État',
  ai: 'Autorité indépendante',
  co: 'Commission consultative',
} as const;
export type AgencyKind = keyof typeof AGENCY_KIND;

export interface AgencyRow {
  /** Name as published by the source. */
  n: string;
  k: AgencyKind;
  f: FateGroup;
  /** Number of entities when one line groups several. */
  e?: number;
  /** Source note (« supprimée depuis 2024 »). */
  x?: string;
}

export interface LawYear {
  year: number;
  legislatif: number;
  reglementaire: number;
  total: number;
}

export interface WorkforceRow {
  id: 'fpe' | 'fpt' | 'fph';
  label: string;
  totalK: number;
  statuts: Array<{ statut: string; k: number }>;
}

/** Compact form sent to the browser: [name, kind, fate, entities (0 = one), note]. */
export type AgencyTuple = [string, AgencyKind, FateGroup, number, string];
export const packAgencies = (rows: AgencyRow[]): AgencyTuple[] =>
  rows.map((r) => [r.n, r.k, r.f, r.e ?? 0, r.x ?? '']);
export const unpackAgencies = (rows: AgencyTuple[]): AgencyRow[] =>
  rows.map(([n, k, f, e, x]) => ({ n, k, f, ...(e ? { e } : {}), ...(x ? { x } : {}) }));
