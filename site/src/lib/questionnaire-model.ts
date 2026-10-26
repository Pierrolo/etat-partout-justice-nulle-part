/**
 * Pure pieces of the questionnaire: types, formatting, and the « were you close? » sentences.
 * No facts.json here — the page builds the questions (lib/questionnaire.ts) and passes them in,
 * so the island does not ship the dataset.
 */
import type { ChipProps } from '@/lib/facts';
import { formatEuro, formatInteger, formatNumber, formatPercentPoints } from '@/lib/format';
import type { Tier } from '@/lib/tiers';

export interface QLink {
  href: string;
  label: string;
}

/**
 * « Proche » (the one rule, for every numeric question): the guess is within CLOSE_REL of the reference,
 * and never nearer than one step of the slider. So a whole-number guess of 7 % beside a 6,4 % reference
 * is close, and 73 % beside 77 % is too; the band does not depend on which question it is.
 * Exceptions: none for numeric questions. A choice question has no band: only the right option is close.
 */
export const CLOSE_REL = 0.1;

export interface QCaveat {
  tone: 'note' | 'announced';
  title: string;
  text: string;
}

interface QuestionBase {
  id: string;
  /** Short status, above the question (« Dépense publique · Insee »). */
  eyebrow: string;
  prompt: string;
  hint: string;
  sources: ChipProps[];
  more: QLink;
  /** Paragraphs shown with the answer. Numbers are already formatted. */
  body: string[];
  caveat?: QCaveat;
  /**
   * Sentence subject in the reveal AND in the closing summary (« Le calcul », « Le décompte du plan »,
   * « L’amendement », « Eurostat »). Never a generic « La table »: it says whose figure this is.
   */
  answerLead: string;
  /**
   * Tier of the reference figure when it comes from the plan: `announced` (manifeste, fiches, chiffrage
   * publié: shown hatched, with the « Annoncé » badge) or `law` (amendment text). Absent for measurements
   * (Insee, Eurostat, DGAFP, Légifrance) and the site's own arithmetic on them.
   */
  tier?: Tier;
  /** A second link, when the answer rests on a documented choice (« Hypothèse H2, dans la Méthode »). */
  also?: QLink;
}

export interface ScaleQuestion extends QuestionBase {
  kind: 'scale';
  min: number;
  max: number;
  step: number;
  unit: '%' | '€' | 'count';
  /** Plural noun after a count (« agences », « millions de mots »). */
  noun?: string;
  /** Accessible name of the number field when `unit` is `count`. */
  entryLabel?: string;
  /** Fraction digits for a guess (the slider steps in whole units). */
  decimals: number;
  truth: number;
  /** Preformatted reference, including its unit (« 6,4 % », « 1 104 agences »). */
  truthLabel: string;
  /** Short label on the scale marker (« calcul », « annoncé », « texte »). */
  marker: string;
}

export interface ChoiceQuestion extends QuestionBase {
  kind: 'choice';
  options: { id: string; label: string }[];
  correctId: string;
  /** Verdict when the picked option is the reference. */
  hitText: string;
  /** Verdict when it is not. */
  missText: string;
}

export type Question = ScaleQuestion | ChoiceQuestion;

export interface Verdict {
  close: boolean;
  text: string;
}

export function formatGuess(q: ScaleQuestion, n: number): string {
  if (q.unit === '%') return formatPercentPoints(n, { decimals: q.decimals });
  if (q.unit === '€') return formatEuro(n, { decimals: q.decimals });
  const shown = q.decimals === 0 ? formatInteger(n) : formatNumber(n, { decimals: q.decimals });
  return q.noun ? `${shown} ${q.noun}` : shown;
}

/** Half-width of the « proche » band of a numeric question, in the unit of the question. */
export function closeBand(q: Pick<ScaleQuestion, 'truth' | 'step'>): number {
  return Math.max(q.step, CLOSE_REL * Math.abs(q.truth));
}

/** The rule in words, for the closing summary. */
export function closeRule(): string {
  const pct = formatPercentPoints(CLOSE_REL * 100, { decimals: 0 });
  return `« Proche » : à ${pct} près de la référence (au moins un cran du curseur) ; pour une question à choix, la bonne réponse.`;
}

/** How far a numeric guess sits from the reference. Never divides by zero. */
export function scaleVerdict(guess: number, truth: number, band: number): Verdict {
  if (!Number.isFinite(guess) || !Number.isFinite(truth) || truth === 0) {
    return { close: false, text: 'Pas de comparaison possible.' };
  }
  if (Math.abs(guess - truth) <= band) return { close: true, text: 'Proche de la référence.' };
  if (guess === 0) return { close: false, text: 'Vous avez répondu zéro.' };
  const over = guess > truth;
  const times = over ? guess / truth : truth / guess;
  if (times < 1.25) {
    return {
      close: false,
      text: over ? 'Un peu au-dessus de la référence.' : 'Un peu en dessous de la référence.',
    };
  }
  const shown = Math.round(times * 10) / 10;
  const n = formatNumber(times, { decimals: shown >= 10 || Number.isInteger(shown) ? 0 : 1 });
  return {
    close: false,
    text: over
      ? `C’est ${n} fois plus que la référence.`
      : `C’est ${n} fois moins que la référence.`,
  };
}

export function choiceVerdict(
  picked: string,
  correctId: string,
  texts?: { hit: string; miss: string },
): Verdict {
  const hit = texts?.hit ?? 'C’est le rang de la table.';
  const miss = texts?.miss ?? 'La table donne un autre rang.';
  if (picked === correctId) return { close: true, text: hit };
  return { close: false, text: miss };
}

export function verdictFor(q: Question, raw: number | string | undefined): Verdict | null {
  if (raw === undefined) return null;
  if (q.kind === 'scale') {
    return typeof raw === 'number' ? scaleVerdict(raw, q.truth, closeBand(q)) : null;
  }
  return typeof raw === 'string'
    ? choiceVerdict(raw, q.correctId, { hit: q.hitText, miss: q.missText })
    : null;
}

/** The closing count. « 1 estimation sur 19 était proche », « 2 estimations sur 19 étaient proches ». */
export function bilanSentence(close: number, total: number): string {
  const shared = 'Chaque chiffre est relié à sa source ci-dessous.';
  if (close === total) return `Toutes vos estimations étaient proches de la référence. ${shared}`;
  if (close === 0) return `Aucune estimation n’était proche de la référence. ${shared}`;
  const count = `${formatInteger(close)} ${close > 1 ? 'estimations' : 'estimation'} sur ${formatInteger(total)}`;
  const verb = close > 1 ? 'étaient proches' : 'était proche';
  return `${count} ${verb} de la référence. ${shared}`;
}
