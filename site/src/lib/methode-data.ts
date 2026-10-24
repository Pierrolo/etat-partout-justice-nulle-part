/**
 * Données de la page /methode qui ne vivent pas dans `docs/METHODE.md` :
 *   - les écarts entre sources, lus dans `pipeline/DISCREPANCIES.md` (une seule source de vérité) ;
 *   - les dénominateurs « par foyer », lus dans facts.json.
 * Le texte est celui du dépôt, nettoyé du jargon de développement (noms de fichiers, « pipeline »).
 */
import discrepanciesMd from '../../../pipeline/DISCREPANCIES.md?raw';
import { fact, num, type FactId } from '@/lib/facts';
import { formatEuro, formatMdEuro, formatNumber } from '@/lib/format';
import { typo } from '@/lib/typo';

export interface Discrepancy {
  code: string;
  title: string;
  /** Ce que disent les sources. */
  constat: string;
  /** Pourquoi elles divergent, quand on le sait (ou « non expliqué »). */
  interpretation: string;
}

/** Retire ce qui n’a de sens que pour un développeur. */
function plain(s: string): string {
  return typo(
    s
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\bdu pipeline\b/g, 'du site')
      .replace(/\ble pipeline\b/g, 'le site')
      .replace(/\(tier calcul\)/g, '(calcul du site)')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

export function parseDiscrepancies(md: string = discrepanciesMd): Discrepancy[] {
  const out: Discrepancy[] = [];
  const re = /^## (D\d+) — (.+)$/gm;
  const heads = [...md.matchAll(re)];
  heads.forEach((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < heads.length ? (heads[i + 1]!.index ?? md.length) : md.length;
    const body = md.slice(start, end).split(/\n---|\n## Hors périmètre/)[0] ?? '';
    const grab = (label: string) => {
      const r = new RegExp(`^- ${label} : (.+?)(?=\\n- (?:Constat|Interprétation|Traitement) :|$)`, 'ms');
      return r.exec(body)?.[1] ?? '';
    };
    out.push({
      code: m[1]!,
      title: plain(m[2]!),
      constat: plain(grab('Constat')),
      interpretation: plain(grab('Interprétation')),
    });
  });
  return out;
}

/** Les écarts que les lecteurs rencontrent d’abord, dans cet ordre. */
export const FEATURED_DISCREPANCIES = ['D16', 'D05', 'D04', 'D08', 'D12', 'D20', 'D18', 'D19'] as const;

/** « Par foyer » : les dénominateurs du livre, leur origine, et celui que le site retient. */
export interface FoyerRow {
  id: FactId;
  usage: string;
  /** Millions de foyers. */
  millions: number;
  origin: string;
  isDefault: boolean;
}

export const DEFAULT_FOYERS_ID: FactId = 'fiche_pop_foyers';

export function foyerDenominators(): FoyerRow[] {
  const md = (id: FactId) => formatMdEuro(num(id), { decimals: 3 });
  const rows: Array<Omit<FoyerRow, 'millions' | 'isDefault'>> = [
    {
      id: 'fiche_pop_foyers',
      usage: `Fiches « Foyer » et « Contribuable » ; « ${formatMdEuro(num('actifs_manifeste_md'))}, soit ${formatEuro(num('actifs_par_foyer_manifeste_eur'))} par foyer »`,
      origin: 'Chiffre écrit par les auteurs dans leurs fiches',
    },
    {
      id: 'foyers_implicites_236_m',
      usage: `« ${formatMdEuro(num('eco236_total_md'), { decimals: 0 })}, soit ${formatEuro(num('eco236_total_eur_foyer'))} par foyer » (tableau des économies)`,
      origin: `${md('eco236_total_md')} ÷ ${formatEuro(num('eco236_total_eur_foyer'))} : déduit par le site`,
    },
    {
      id: 'foyers_implicites_dep_m',
      usage: `« ${formatEuro(num('dep_par_foyer_manifeste_eur'))} par foyer et par an » (dépenses publiques, manifeste)`,
      origin: `${md('dep_total_2024_md')} ÷ ${formatEuro(num('dep_par_foyer_manifeste_eur'))} : déduit par le site`,
    },
    {
      id: 'foyers_fiscaux_loi_m',
      usage: 'Exposé de l’amendement PLF-P1 n° 28 (aide fondamentale)',
      origin: `Foyers fiscaux (dont ${formatNumber(num('foyers_fiscaux_irpp_loi_m'), { decimals: 1 })} millions seulement paient l’impôt sur le revenu)`,
    },
  ];
  return rows.map((r) => {
    const f = fact(r.id);
    const m = f.unit.startsWith('millions')
      ? (f.value as number)
      : (f.value as number) / 1e6; // fiche_pop_foyers est en foyers
    return { ...r, millions: m, isDefault: r.id === DEFAULT_FOYERS_ID };
  });
}

/** PIB implicite d’un taux de dépenses publiques de 57,0 % avec le total COFOG (D04), en Md€. */
export function impliedGdpMd(): { implied: number; workbook: number; gap: number; gapPct: number } {
  const total = num('dep_total_2024_md');
  const workbook = num('po_pib_2024_md');
  const implied = total / (num('eu_dep_pib_fr_2024_pct') / 100);
  return { implied, workbook, gap: implied - workbook, gapPct: ((implied - workbook) / workbook) * 100 };
}

