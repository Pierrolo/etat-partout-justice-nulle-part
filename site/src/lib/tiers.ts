/**
 * The three epistemic tiers (docs/VISION.md §2.3). Every figure on the site wears exactly one.
 * The `Tier` type is owned by the engine so that `explain()` output and the UI can never drift.
 *
 *   law         solid      « Écrit dans la loi »        (amendment text)
 *   announced   hatched    « Annoncé par les auteurs »  (fiches / manifeste / tableurs, no legal text)
 *   hypothesis  dotted     « Hypothèse du simulateur »  (our choice where the text is silent)
 */
import { TIERS, type Tier } from '@epjn/engine';

export type { Tier };
export { TIERS };

export interface TierMeta {
  label: string;
  /** Short label for tight spaces (table cells, chart legends). */
  short: string;
  /** One plain-French sentence explaining what the tier means. */
  description: string;
}

export const TIER_META: Record<Tier, TierMeta> = {
  law: {
    label: 'Écrit dans la loi',
    short: 'Loi',
    description:
      'Chiffré dans le texte d’un amendement : il s’appliquerait tel quel si le texte était voté.',
  },
  announced: {
    label: 'Annoncé par les auteurs',
    short: 'Annoncé',
    description:
      'Avancé par les auteurs (fiches, manifeste, tableurs) mais sans texte de loi. Montré à part, hors revenu disponible.',
  },
  hypothesis: {
    label: 'Hypothèse du simulateur',
    short: 'Hypothèse',
    description:
      'Notre choix là où le texte est muet. Listé dans le registre des hypothèses, modifiable quand cela compte.',
  },
};

export function isTier(value: unknown): value is Tier {
  return typeof value === 'string' && (TIERS as readonly string[]).includes(value);
}
