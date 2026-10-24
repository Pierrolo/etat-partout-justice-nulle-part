/**
 * « Combien de temps pour lire le droit ? » — a human-scale reframing of the number of words of law.
 *
 * NOT a fact of the book: a derived figure with two stated hypotheses, shown wherever it is used.
 *   durée de lecture (h)  = mots ÷ vitesse de lecture (mots/min) ÷ 60
 *   années à temps plein  = durée de lecture (h) ÷ durée annuelle légale du travail (h/an)
 */
import { num } from '@/lib/facts';

export const READING_HYPOTHESES = {
  /** Silent reading of an ordinary text: about 250 words a minute (hypothèse du site, pas un fait). */
  wordsPerMinute: 250,
  /** Durée annuelle légale du travail à temps plein : fact `duree_legale_travail_h_an` (1 607 h, Légifrance). */
  fullTimeHoursPerYear: num('duree_legale_travail_h_an'),
} as const;

export interface ReadingTime {
  words: number;
  minutes: number;
  hours: number;
  fullTimeYears: number;
}

export function readingTime(
  words: number,
  h: { wordsPerMinute: number; fullTimeHoursPerYear: number } = READING_HYPOTHESES,
): ReadingTime {
  const minutes = words / h.wordsPerMinute;
  const hours = minutes / 60;
  return { words, minutes, hours, fullTimeYears: hours / h.fullTimeHoursPerYear };
}
