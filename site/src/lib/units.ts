/**
 * Unit toggle of /comprendre/depenses: the same national amount, said four ways.
 * Denominators always come from facts.json and are stated next to the figure (docs/VISION.md §2.2):
 * the book uses several « foyers » (30 / 29,5 / 31 / 40 M), so a « par foyer » amount is only valid
 * with the denominator printed beside it, and is never compared with another source's.
 */
import { formatCompactEuro, formatEuro, formatNumber, NBSP } from './format';

export type UnitKey = 'an' | 'foyer-an' | 'foyer-jour' | 'habitant-an';

export interface Denominators {
  /** Number of foyers (people), in units. */
  foyers: number;
  habitants: number;
}

export const UNIT_ORDER: UnitKey[] = ['an', 'foyer-an', 'foyer-jour', 'habitant-an'];

export const UNIT_LABEL: Record<UnitKey, string> = {
  an: 'Par an',
  'foyer-an': 'Par foyer et par an',
  'foyer-jour': 'Par foyer et par jour',
  'habitant-an': 'Par habitant et par an',
};

export const UNIT_SHORT: Record<UnitKey, string> = {
  an: 'Md€ par an',
  'foyer-an': '€ par foyer et par an',
  'foyer-jour': '€ par foyer et par jour',
  'habitant-an': '€ par habitant et par an',
};

/** Euros for one unit, from an amount in Md€. */
export function convertMd(valueMd: number, unit: UnitKey, d: Denominators, days = 365): number {
  const euros = valueMd * 1e9;
  switch (unit) {
    case 'an':
      return euros;
    case 'foyer-an':
      return euros / d.foyers;
    case 'foyer-jour':
      return euros / d.foyers / days;
    case 'habitant-an':
      return euros / d.habitants;
  }
}

/** « 392 Md€ », « 12 660 € », « 34,69 € » — adaptive decimals, always with its unit symbol. */
export function formatUnit(valueMd: number, unit: UnitKey, d: Denominators): string {
  const v = convertMd(valueMd, unit, d);
  if (unit === 'an') return formatCompactEuro(v);
  if (unit === 'foyer-jour') return formatEuro(v, { decimals: v < 10 ? 2 : 0 });
  return formatEuro(v);
}

/** Same, without the unit symbol, for tight tiles: « 392 », « 12 660 », « 1,19 ». */
export function formatUnitBare(valueMd: number, unit: UnitKey, d: Denominators): string {
  const v = convertMd(valueMd, unit, d);
  if (unit === 'an')
    return formatNumber(valueMd, { decimals: valueMd >= 100 ? 0 : valueMd >= 10 ? 0 : 1 });
  return formatNumber(v, { decimals: unit === 'foyer-jour' && v < 10 ? 2 : 0 });
}

/** Short unit suffix to print after a bare number. */
export const UNIT_SUFFIX: Record<UnitKey, string> = {
  an: `${NBSP}Md€`,
  'foyer-an': `${NBSP}€/an`,
  'foyer-jour': `${NBSP}€/jour`,
  'habitant-an': `${NBSP}€/an`,
};

/** The four sentences of the readout (« Retraites : 392 Md€, soit … »). */
export function allUnits(valueMd: number, d: Denominators) {
  return UNIT_ORDER.map((u) => ({
    unit: u,
    text: formatUnit(valueMd, u, d),
    label: UNIT_SHORT[u],
  }));
}
