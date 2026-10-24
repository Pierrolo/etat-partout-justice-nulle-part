/**
 * Pure pieces of the questionnaire: types, formatting, and the « were you close? » sentences.
 * No facts.json here — the page builds the questions (lib/questionnaire.ts) and passes them in,
 * so the island does not ship the dataset.
 */
import type { ChipProps } from '@/lib/facts';
import { formatEuro, formatInteger, formatNumber, formatPercentPoints } from '@/lib/format';

export interface QLink {
  href: string;
  label: string;
}

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
  /** Sentence subject in the reveal (« Le calcul », « Leur décompte », « L’amendement »). */
  answerLead: string;
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
  /** Absolute distance that still counts as « très proche ». */
  closeAbs: number;
  /** Short label on the scale marker (« calcul », « eux »). */
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

/** How far a numeric guess sits from the reference. Never divides by zero. */
export function scaleVerdict(guess: number, truth: number, closeAbs: number): Verdict {
  if (!Number.isFinite(guess) || !Number.isFinite(truth) || truth === 0) {
    return { close: false, text: 'Pas de comparaison possible.' };
  }
  if (Math.abs(guess - truth) <= closeAbs) return { close: true, text: 'Très proche.' };
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
    return typeof raw === 'number' ? scaleVerdict(raw, q.truth, q.closeAbs) : null;
  }
  return typeof raw === 'string'
    ? choiceVerdict(raw, q.correctId, { hit: q.hitText, miss: q.missText })
    : null;
}

export function bilanSentence(close: number, total: number): string {
  const shared = 'Ces ordres de grandeur sont rarement montrés ensemble.';
  if (close === total) return `Toutes vos estimations étaient proches de la référence. ${shared}`;
  if (close === 0) return `Aucune estimation n’était proche de la référence. ${shared}`;
  const word = close > 1 ? 'estimations' : 'estimation';
  return `${formatInteger(close)} ${word} sur ${formatInteger(total)} étaient proches de la référence. ${shared}`;
}
