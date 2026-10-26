/**
 * Build-time views of etat-partout.json and agences.json for /comprendre/etat-partout.
 * Server only (imports the big JSON files): pages call these in the frontmatter and pass the small
 * results to islands as props.
 */
import agences from '@/data/agences.json';
import etat from '@/data/etat-partout.json';
import type {
  AgencyRow,
  FateCount,
  FateGroup,
  LawYear,
  MinistryDot,
  MinistryFate,
  WorkforceRow,
} from './etat-shared';

export * from './etat-shared';

/* ── 35 ministères → 7 ─────────────────────────────────────────────────── */

export function ministries() {
  const m = etat.ministeres;
  const seen = new Set<string>();
  const dots: MinistryDot[] = m.detail.map((d) => {
    if (d.status === 'supprime' || !d.group_id)
      return { label: d.label_fr, fate: 'supprime', block: null };
    const first = !seen.has(d.group_id);
    seen.add(d.group_id);
    return { label: d.label_fr, fate: first ? 'garde' : 'absorbe', block: d.group_id };
  });
  const order: Record<MinistryFate, number> = { garde: 0, absorbe: 1, supprime: 2 };
  dots.sort((a, b) => order[a.fate] - order[b.fate]);
  const blocks = m.groupes_maintenus.map((g) => ({
    id: g.id,
    label: g.label_fr,
    merged: g.n_ministeres_regroupes,
  }));
  return {
    dots,
    blocks,
    before: m.avant,
    after: m.apres,
    removedOutright: m.supprimes_integralement,
    regrouped: m.regroupes_dans_les_sept,
    removedNet: m.supprimes_net,
    inferred: m.grouping_inferred,
    note: m.grouping_note,
    reconciliation: m.reconciliation,
    source: m.source,
  };
}

/* ── 1 104 agences ─────────────────────────────────────────────────────── */

export function agencyFates(): FateCount[] {
  const n = (id: string) => agences.sorts_agences_etat.find((s) => s.fate === id)?.n ?? 0;
  const rowOf = (id: string) => agences.matrice_sorts.find((r) => r.id === id);
  const kinds: Array<[string, string]> = [
    ['operateurs_plf', 'opérateurs de l’État'],
    ['organismes_hors_plf', 'autres organismes'],
    ['autorites_independantes', 'autorités indépendantes'],
    ['commissions', 'commissions'],
  ];
  const parts = (pick: (r: NonNullable<ReturnType<typeof rowOf>>) => number) =>
    kinds
      .map(([id, label]) => ({ label, n: rowOf(id) ? pick(rowOf(id)!) : 0 }))
      .filter((p) => p.n > 0);
  return [
    { id: 'suppression', n: n('suppression'), parts: parts((r) => r.suppression) },
    { id: 'cession', n: n('cession'), parts: parts((r) => r.cession) },
    { id: 'internalisation', n: n('internalisation'), parts: parts((r) => r.internalisation) },
    {
      id: 'autonomie',
      n: n('epic_musee') + n('epic_enseignement') + n('autorite_independante'),
      parts: parts((r) => r.epic_enseignement + r.epic_musee + r.autorite_independante),
    },
  ];
}

const toGroup = (fate: string | null): FateGroup | null => {
  if (!fate) return null;
  if (fate === 'suppression' || fate === 'cession' || fate === 'internalisation') return fate;
  return 'autonomie';
};

/** The named lines of the workbook: 180 operator lines, 328 other bodies, 24 authorities, 324 commissions. */
export function agencyRows(): AgencyRow[] {
  const rows: AgencyRow[] = [];
  for (const o of agences.operateurs) {
    const f = toGroup(o.fate);
    if (f) rows.push({ n: o.name, k: 'op', f, ...(o.n_entities > 1 ? { e: o.n_entities } : {}) });
  }
  for (const o of agences.organismes_odac) {
    const f = toGroup(o.fate);
    if (f && !o.already_counted_as_operator) rows.push({ n: o.name, k: 'hp', f });
  }
  for (const o of agences.autorites_independantes) {
    const f = toGroup(o.fate);
    if (f) rows.push({ n: o.name, k: 'ai', f });
  }
  for (const o of agences.commissions) {
    const f = toGroup(o.fate);
    if (f)
      rows.push({
        n: o.name,
        k: 'co',
        f,
        ...(o.statut_jaune_2026 && o.statut_jaune_2026 !== 'en vigueur'
          ? { x: o.statut_jaune_2026 }
          : {}),
      });
  }
  return rows;
}

export const agencyMeta = {
  source: agences.meta.source,
  notes: agences.meta.notes as string[],
  tierNote: agences.meta.tier_note as string,
  lawList: {
    n: agences.entites_dissoutes_loi.n as number,
    date: agences.entites_dissoutes_loi.date as string,
    amendment: agences.entites_dissoutes_loi.amendement as unknown,
  },
};

/* ── Mots de loi ───────────────────────────────────────────────────────── */

export function lawWords() {
  const w = etat.mots_de_loi;
  return {
    years: w.series.map((s): LawYear => ({
      year: s.year,
      legislatif: s.legislatif_total,
      reglementaire: s.reglementaire_total,
      total: s.total,
    })),
    breaks: w.series_break_flags.map((b) => ({
      year: b.year,
      series: b.series,
      changePct: b.change_pct,
      from: b.from,
      to: b.to,
    })),
    breakNote: w.series_break_note,
    source: w.source,
    growth: w.growth,
  };
}

/* ── Effectifs publics ─────────────────────────────────────────────────── */

export function workforce() {
  const e = etat.effectifs_publics;
  const rows: WorkforceRow[] = (['fpe', 'fpt', 'fph'] as const).map((id) => {
    const v = e.par_versant[id];
    return {
      id,
      label: v.label_fr,
      totalK: v.total_milliers,
      statuts: v.par_statut.map((s) => ({ statut: s.statut, k: s.milliers })),
    };
  });
  return { rows, source: e.source, totalK: e.total_milliers, year: e.year };
}

/* ── Chaîne démocratique 100 → 3,45 ────────────────────────────────────── */

export function democraticChain() {
  const r = etat.representation_democratique;
  return {
    steps: r.steps.map((s) => ({
      label: s.label_fr,
      value: s.value,
      pctOfPrevious: s.pct_of_previous,
    })),
    rule: r.rule,
    source: r.source,
  };
}

export const manifestoClaims = etat.revendications_manifeste.map((c) => ({
  id: c.id,
  label: c.label_fr,
  quote: c.source.quote as string | undefined,
}));
