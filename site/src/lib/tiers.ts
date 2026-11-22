/**
 * The three epistemic tiers (docs/VISION.md §2.3). Every figure on the site wears exactly one.
 * The `Tier` type is owned by the engine so that `explain()` output and the UI can never drift;
 * the ids (`law`, `announced`, `hypothesis`) never change, only the words readers see.
 *
 * Plain-French vocabulary (docs/qa/FIX-PLAN.md, « Tier vocabulary »): « Loi » made readers think the
 * text was voted, so the words now say what the text is: written and published, not in force.
 * The site speaks in the plan's own voice (docs/VISION.md §2.5), so « Annoncé » is the plan's announcement.
 *
 *   law         solid      « Proposé dans un amendement »  (amendment written and published, not in force)
 *   announced   hatched    « Annoncé »                     (fiches / manifeste / chiffrage publié, no precise text)
 *   hypothesis  dotted     « Notre estimation »            (our choice where the text is silent)
 *
 * Never say an amendment « will be filed » or « will be voted »: no source says so. Say what it is today.
 *
 * Simulator outputs carry no tier of their own: each line carries the tier of the rule that drives it.
 */
import { TIERS, type Tier } from '@epjn/engine';

export type { Tier };
export { TIERS };

export interface TierMeta {
  /** Full label (« Proposé dans un amendement »). */
  label: string;
  /** Short label for tight spaces (table cells, chart legends, source chips). */
  short: string;
  /** Parenthetical, lower-case clarification, to follow the label (« texte rédigé et publié… »). */
  explanation: string;
  /** One or two plain-French sentences explaining what the tier means for the reader. */
  description: string;
}

export const TIER_META: Record<Tier, TierMeta> = {
  law: {
    label: 'Proposé dans un amendement',
    short: 'Amendement proposé',
    explanation: 'texte rédigé et publié, pas en vigueur',
    description:
      'Texte précis d’un amendement rédigé et publié. Aucun n’est en vigueur : il s’appliquerait tel quel s’il était adopté.',
  },
  announced: {
    label: 'Annoncé',
    short: 'Annoncé',
    explanation: 'annoncé, sans texte précis',
    description:
      'Chiffre ou promesse du plan, sans texte d’amendement. Quand il n’y a pas de montant, c’est montré à part, hors revenu disponible.',
  },
  hypothesis: {
    label: 'Notre estimation',
    short: 'Estimation',
    explanation: 'choix du simulateur là où le texte est muet',
    description:
      'Choix du simulateur là où le texte est muet. Listé dans le registre des hypothèses, modifiable quand cela compte.',
  },
};

/** Label followed by its clarification, for sentences and `title` attributes. */
export function tierSentence(tier: Tier): string {
  const m = TIER_META[tier];
  return `${m.label} (${m.explanation})`;
}

export function isTier(value: unknown): value is Tier {
  return typeof value === 'string' && (TIERS as readonly string[]).includes(value);
}
