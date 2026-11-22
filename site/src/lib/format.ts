/**
 * French number formatting — the ONLY place numbers become strings for display.
 *
 *   « 1 234 € »  thousands = U+202F narrow no-break space, space before € / % = U+00A0,
 *   decimal = « , », minus = U+2212 « − » (never a hyphen), plus sign explicit on deltas.
 *
 * Built on `Intl.NumberFormat('fr-FR').formatToParts()` but every separator is re-emitted from
 * constants, so the output is byte-identical in Node (build time) and in any browser (islands):
 * no hydration mismatch, no dependency on the CLDR version of the runtime.
 *
 * Rules (docs/VISION.md §2, sota-inspiration §5):
 *  - big numbers come with a human-scale reframing (`reframe`) — never alone;
 *  - avoid false precision: use `roundForDisplay` (5 €/month) for simulator outputs;
 *  - the fonts must carry U+202F: see « EPJN Narrow Space » in styles/global.css.
 */

export const NNBSP = ' '; // narrow no-break space — thousands separator
export const NBSP = ' '; // no-break space — before units
export const MINUS = '−'; // true minus sign
export const EM_DASH = '—';
const LOCALE = 'fr-FR';

type Decimals = number | { min: number; max: number };

const cache = new Map<string, Intl.NumberFormat>();
function nf(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = JSON.stringify(options);
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE, { useGrouping: 'always', ...options });
    cache.set(key, f);
  }
  return f;
}

function render(value: number, options: Intl.NumberFormatOptions): string {
  return nf(options)
    .formatToParts(value)
    .map((p) => {
      switch (p.type) {
        case 'group':
          return NNBSP;
        case 'decimal':
          return ',';
        case 'minusSign':
          return MINUS;
        case 'plusSign':
          return '+';
        case 'literal':
          return NBSP;
        case 'currency':
          return '€';
        case 'percentSign':
          return '%';
        default:
          return p.value;
      }
    })
    .join('');
}

function fractionOptions(decimals: Decimals): Intl.NumberFormatOptions {
  return typeof decimals === 'number'
    ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
    : { minimumFractionDigits: decimals.min, maximumFractionDigits: decimals.max };
}

export interface NumberOptions {
  /** Fraction digits: a fixed number, or `{ min, max }`. Default 0. */
  decimals?: Decimals;
  /** Show « + » for positive values (« − » is always shown for negatives). */
  signed?: boolean;
  /** Returned when the value is not a finite number. Default « — ». */
  fallback?: string;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function sign(signed?: boolean): Intl.NumberFormatOptions {
  return { signDisplay: signed ? 'exceptZero' : 'negative' };
}

/** 1234.5 → « 1 234,5 » (with decimals: 1) */
export function formatNumber(value: number, opts: NumberOptions = {}): string {
  if (!isNum(value)) return opts.fallback ?? EM_DASH;
  return render(value, { ...fractionOptions(opts.decimals ?? 0), ...sign(opts.signed) });
}

/** Integer count: 1104 → « 1 104 ». */
export function formatInteger(value: number, opts: Pick<NumberOptions, 'fallback'> = {}): string {
  return formatNumber(value, { decimals: 0, ...opts });
}

export interface EuroOptions extends Omit<NumberOptions, 'decimals'> {
  /** Default 0. `'auto'` → no decimals for whole amounts, 2 otherwise. */
  decimals?: Decimals | 'auto';
}

/** 1234 → « 1 234 € »; 1234.5 with decimals 2 → « 1 234,50 € ». */
export function formatEuro(value: number, opts: EuroOptions = {}): string {
  if (!isNum(value)) return opts.fallback ?? EM_DASH;
  const decimals: Decimals =
    opts.decimals === 'auto' ? (Number.isInteger(value) ? 0 : 2) : (opts.decimals ?? 0);
  return render(value, {
    style: 'currency',
    currency: 'EUR',
    currencyDisplay: 'symbol',
    ...fractionOptions(decimals),
    ...sign(opts.signed),
  });
}

/** Always signed: 212 → « +212 € », −40 → « −40 € », 0 → « 0 € ». */
export function formatEuroDelta(value: number, opts: EuroOptions = {}): string {
  return formatEuro(value, { ...opts, signed: true });
}

export type Period = 'mois' | 'an' | 'jour' | 'heure';

/** 212 → « 212 €/mois ». Pass `signed` for deltas: « +212 €/mois ». */
export function formatEuroPer(value: number, period: Period, opts: EuroOptions = {}): string {
  if (!isNum(value)) return opts.fallback ?? EM_DASH;
  return `${formatEuro(value, opts)}/${period}`;
}
export const formatEuroPerMonth = (value: number, opts: EuroOptions = {}) =>
  formatEuroPer(value, 'mois', opts);

/**
 * Ratio → percent: 0.09 → « 9 % », signed → « +9 % ». Input is a RATIO (0.09), not 9.
 * Use `formatPercentPoints` for values that are already in percent.
 */
export function formatPercent(ratio: number, opts: NumberOptions = {}): string {
  if (!isNum(ratio)) return opts.fallback ?? EM_DASH;
  return render(ratio, {
    style: 'percent',
    ...fractionOptions(opts.decimals ?? 0),
    ...sign(opts.signed),
  });
}

/** 57.1 → « 57,1 % » (input already in percent). */
export function formatPercentPoints(percent: number, opts: NumberOptions = {}): string {
  if (!isNum(percent)) return opts.fallback ?? EM_DASH;
  return formatPercent(percent / 100, opts);
}

/* ── Compact amounts: Md€ / M€ / k€ ─────────────────────────────────────── */

export interface CompactOptions {
  /** Fixed fraction digits. Default: adaptive (0 above 100, 1 above 10, else 2; trailing zeros dropped). */
  decimals?: number;
  /** « milliards d'euros » instead of « Md€ ». */
  long?: boolean;
  signed?: boolean;
  fallback?: string;
}

const COMPACT_UNITS = [
  { min: 1e9, div: 1e9, short: 'Md€', long: 'milliards d’euros', longOne: 'milliard d’euros' },
  { min: 1e6, div: 1e6, short: 'M€', long: 'millions d’euros', longOne: 'million d’euros' },
  { min: 1e3, div: 1e3, short: 'k€', long: 'milliers d’euros', longOne: 'millier d’euros' },
] as const;

function adaptiveDecimals(abs: number): Decimals {
  if (abs >= 100) return 0;
  if (abs >= 10) return { min: 0, max: 1 };
  return { min: 0, max: 2 };
}

/** 1.672e12 → « 1 672 Md€ »; 236e9 → « 236 Md€ »; 8.4e9 → « 8,4 Md€ »; 450 → « 450 € ». */
export function formatCompactEuro(euros: number, opts: CompactOptions = {}): string {
  if (!isNum(euros)) return opts.fallback ?? EM_DASH;
  const abs = Math.abs(euros);
  const unit = COMPACT_UNITS.find((u) => abs >= u.min);
  if (!unit) return formatEuro(euros, { signed: opts.signed });
  const scaled = euros / unit.div;
  const label = opts.long ? (Math.abs(scaled) < 2 ? unit.longOne : unit.long) : unit.short;
  const num = formatNumber(scaled, {
    decimals: opts.decimals ?? adaptiveDecimals(Math.abs(scaled)),
    signed: opts.signed,
  });
  return `${num}${NBSP}${label}`;
}

/** Same, from a value already expressed in milliards d'euros: 1672 → « 1 672 Md€ ». */
export function formatMdEuro(milliards: number, opts: CompactOptions = {}): string {
  if (!isNum(milliards)) return opts.fallback ?? EM_DASH;
  return formatCompactEuro(milliards * 1e9, opts);
}

/* ── Rounding & parsing ─────────────────────────────────────────────────── */

/** Avoid false precision: 212.4 → 210 (step 5 → 210, step 10 → 210), 213 → 215 (step 5). */
export function roundForDisplay(value: number, step = 5): number {
  if (!isNum(value)) return value;
  const r = Math.round(value / step) * step;
  return Object.is(r, -0) ? 0 : r;
}

/**
 * Tolerant parser for user input: « 1 234,5 », « 1234.5 », « 1.234,56 », « 2 500 € », « −40 ».
 * Returns null when no number can be read. With both separators the LAST one is the decimal mark;
 * a lone separator is read as the decimal mark (so « 1.234 » is 1,234 — French input convention).
 */
export function parseFrenchNumber(input: string): number | null {
  if (typeof input !== 'string') return null;
  let s = input
    .replace(/[\s   ]/g, '')
    .replace(/[€%]|\/mois|\/an|eur(os?)?/gi, '')
    .replace(/[−–—]/g, '-');
  if (s === '' || s === '-' || s === '+') return null;
  const negative = s.startsWith('-');
  s = s.replace(/^[+-]/, '');
  if (!/^[\d.,]+$/.test(s)) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  const decimalAt = Math.max(lastComma, lastDot);
  let intPart = s;
  let fracPart = '';
  if (decimalAt >= 0) {
    intPart = s.slice(0, decimalAt);
    fracPart = s.slice(decimalAt + 1);
  }
  intPart = intPart.replace(/[.,]/g, '');
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart)) return null;
  if (intPart === '' && fracPart === '') return null;
  const n = Number(`${intPart || '0'}${fracPart ? `.${fracPart}` : ''}`);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/* ── Human-scale reframing ──────────────────────────────────────────────── */

export interface Reframing {
  perHouseholdYear: number;
  perHouseholdMonth: number;
  perHouseholdDay: number;
}

/**
 * A national annual total (in €) expressed for ONE household.
 * `households` must come from facts.json (never hard-code it in a component).
 *   reframe({ annualTotal: 1.672e12, households: 30e6 }).perHouseholdDay → ≈ 153
 */
export function reframe(input: {
  annualTotal: number;
  households: number;
  daysPerYear?: number;
}): Reframing {
  const { annualTotal, households, daysPerYear = 365 } = input;
  if (!(households > 0)) throw new RangeError('households must be > 0');
  const perHouseholdYear = annualTotal / households;
  return {
    perHouseholdYear,
    perHouseholdMonth: perHouseholdYear / 12,
    perHouseholdDay: perHouseholdYear / daysPerYear,
  };
}

/** « = 148 € par foyer et par jour » */
export function reframeSentence(
  r: Reframing,
  per: 'jour' | 'mois' | 'an' = 'jour',
  opts: { prefix?: string } = {},
): string {
  const amount =
    per === 'jour' ? r.perHouseholdDay : per === 'mois' ? r.perHouseholdMonth : r.perHouseholdYear;
  const prefix = opts.prefix ?? `=${NBSP}`;
  return `${prefix}${formatEuro(amount)} par foyer et par ${per === 'an' ? 'an' : per}`;
}
