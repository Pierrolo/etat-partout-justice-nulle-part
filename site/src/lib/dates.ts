/**
 * Dates en français, déterministes (fuseau UTC, aucune horloge) : le même texte au build et dans le
 * navigateur. Aucune fonction ici ne lit « aujourd'hui » : le site est statique et reproductible.
 */

const parts = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const monthYear = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const shortMonth = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' });
const shortDayMonth = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** « 2027-07-01 » → « 1er juillet 2027 » ; « 2027-12-31 » → « 31 décembre 2027 ». */
export function formatDateFr(iso: string): string {
  const d = utc(iso);
  const p = parts.formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  const day = get('day') === '1' ? '1er' : get('day');
  return `${day} ${get('month')} ${get('year')}`;
}

/** « 2027-07-01 » → « juillet 2027 ». */
export function formatMonthYearFr(iso: string): string {
  return monthYear.format(utc(iso));
}

/** « 2027-07-01 » → « juil. » */
export function formatShortMonthFr(iso: string): string {
  return shortMonth.format(utc(iso));
}

/** « 2027-07-01 » → « 1 juil. » (étiquettes serrées). */
export function formatDayMonthFr(iso: string): string {
  const s = shortDayMonth.format(utc(iso));
  return s.startsWith('1 ') ? `1er ${s.slice(2)}` : s;
}

/** Millisecondes UTC d'une date ISO (axe de temps). */
export const timeOf = (iso: string): number => utc(iso).getTime();

/** Texte de précision d'une date de la loi (`jour` | `annee` | `approx`). */
export function precisionNote(precision: string): string | null {
  switch (precision) {
    case 'annee':
      return 'Année sans jour précis : le 1er janvier est retenu par convention.';
    case 'approx':
      return 'Point de départ non daté dans le texte (« lendemain de la publication de la loi »).';
    default:
      return null;
  }
}
