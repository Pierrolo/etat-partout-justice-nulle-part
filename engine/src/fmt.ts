/** French number formatting (narrow no-break space thousands separator, comma decimals). */
const nf2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nfp = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

export const r2 = (x: number): number =>
  Math.round((x + Number.EPSILON * Math.sign(x)) * 100) / 100;
export const roundTo = (x: number, d: number): number => {
  const f = 10 ** d;
  return Math.round(x * f + (x >= 0 ? 1e-9 : -1e-9)) / f;
};

/** « 1 234,56 € » */
export function eur(x: number): string {
  const v = Math.abs(x) < 0.005 ? 0 : x;
  return `${nf2.format(v)} €`;
}
/** « 1 235 € » */
export function eur0(x: number): string {
  const v = Math.abs(x) < 0.5 ? 0 : x;
  return `${nf0.format(v)} €`;
}
/** rate 0.097 → « 9,7 % » */
export function pct(rate: number): string {
  return `${nfp.format(rate * 100)} %`;
}
export function num(x: number, digits = 2): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(x);
}
