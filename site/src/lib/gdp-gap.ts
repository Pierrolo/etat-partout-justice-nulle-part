/**
 * 57,0 % (Eurostat) ou 57,3 % (Insee ÷ PIB du classeur) ? La dépense est la même (1 671,8 Md€) ; l’écart vient
 * du PIB pris au dénominateur. Cette fonction dit exactement de combien (DISCREPANCIES D04).
 */
import { num } from '@/lib/facts';

/** PIB qu’il faudrait pour que le total COFOG fasse le taux d’Eurostat, comparé au PIB du classeur (Md€). */
export function impliedGdpMd(): { implied: number; workbook: number; gap: number; gapPct: number } {
  const total = num('dep_total_2024_md');
  const workbook = num('po_pib_2024_md');
  const implied = total / (num('eu_dep_pib_fr_2024_pct') / 100);
  return {
    implied,
    workbook,
    gap: implied - workbook,
    gapPct: ((implied - workbook) / workbook) * 100,
  };
}
