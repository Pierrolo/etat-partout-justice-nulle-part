/**
 * Glossaire : définitions en français courant (`data/glossaire.json`, écrit à la main) et comportement
 * « toggletip » partagé par la variante React (`<Term>`) et la variante Astro (`<GlossaryTerm>`).
 *
 * Le toggletip n’est jamais réservé au survol : un bouton (`aria-expanded`, `aria-controls`) ouvre une
 * bulle dans une région `role="status"`, annoncée par les lecteurs d’écran ; Échap la ferme et rend le
 * focus au bouton ; un tap ou un clic ailleurs la ferme.
 */
import raw from '@/data/glossaire.json';
import { withBase } from '@/lib/site';

export interface GlossaryEntry {
  id: string;
  /** Nom complet, développé (« Aide fondamentale universelle (AFU) »). */
  term: string;
  /** Une ou deux phrases en français courant. */
  definition: string;
  /** Page du site pour en savoir plus, sans préfixe de base (« /methode#h1 »). */
  href?: string;
}

interface RawEntry {
  term: string;
  definition: string;
  href?: string;
  aliases?: string[];
}

const ENTRIES = raw as unknown as Record<string, RawEntry | string>;
const byId = new Map<string, GlossaryEntry>();
for (const [id, v] of Object.entries(ENTRIES)) {
  if (typeof v === 'string') continue; // « _comment »
  const entry: GlossaryEntry = { id, term: v.term, definition: v.definition, href: v.href };
  byId.set(id, entry);
  for (const alias of v.aliases ?? []) byId.set(alias, entry);
}

/** Tous les identifiants acceptés par `<Term id>` (identifiants et alias). */
export const GLOSSARY_IDS: readonly string[] = [...byId.keys()];

/** Entrées distinctes, triées par nom — pour une page « glossaire ». */
export function glossaryEntries(): GlossaryEntry[] {
  return [...new Set(byId.values())].sort((a, b) => a.term.localeCompare(b.term, 'fr'));
}

export function lookupTerm(id: string): GlossaryEntry | undefined {
  return byId.get(id);
}

/** Lien « En savoir plus » prêt à l’emploi (préfixe de base compris). */
export function termHref(entry: GlossaryEntry): string | undefined {
  return entry.href ? withBase(entry.href) : undefined;
}

/** Évènement envoyé quand une bulle s’ouvre : les autres se ferment. */
export const GLOSSARY_OPEN_EVENT = 'epjn:glossary-open';

/**
 * Garde la bulle dans la fenêtre : décalage horizontal si elle déborde, et au-dessus du terme
 * s’il n’y a pas de place en dessous.
 */
export function placeBubble(anchor: HTMLElement, bubble: HTMLElement): void {
  bubble.style.left = '0px';
  bubble.style.top = '';
  bubble.style.bottom = '';
  const margin = 8;
  const vw = document.documentElement.clientWidth;
  const rect = bubble.getBoundingClientRect();
  let shift = 0;
  if (rect.right > vw - margin) shift = vw - margin - rect.right;
  if (rect.left + shift < margin) shift = margin - rect.left;
  bubble.style.left = `${Math.round(shift)}px`;
  const a = anchor.getBoundingClientRect();
  const vh = window.innerHeight;
  if (a.bottom + rect.height + margin > vh && a.top - rect.height - margin > 0) {
    bubble.style.top = 'auto';
    bubble.style.bottom = 'calc(100% + 6px)';
  }
}
