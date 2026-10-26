/**
 * Comportement du toggletip pour la variante Astro (`GlossaryTerm.astro`), sans React.
 * Délégation d’évènements sur le document : un seul écouteur pour tous les termes de la page.
 * Le balisage est identique à celui de `<Term>` (components/ui/Glossary.tsx).
 */
import { GLOSSARY_OPEN_EVENT, placeBubble } from './glossary';

let ready = false;

function bubbleOf(wrap: Element): HTMLElement | null {
  return wrap.querySelector('.gloss-bubble');
}

function close(wrap: Element, refocus = false): void {
  const btn = wrap.querySelector<HTMLButtonElement>('.gloss-btn');
  const live = wrap.querySelector('.gloss-live');
  if (!btn) return;
  btn.setAttribute('aria-expanded', 'false');
  if (live) live.textContent = '';
  if (refocus) btn.focus();
}

function closeAll(except?: Element): void {
  document.querySelectorAll('.gloss').forEach((w) => {
    if (w !== except && w.querySelector('.gloss-bubble')) close(w);
  });
}

function open(wrap: Element): void {
  const btn = wrap.querySelector<HTMLButtonElement>('.gloss-btn');
  const live = wrap.querySelector<HTMLElement>('.gloss-live');
  if (!btn || !live) return;
  closeAll(wrap);
  document.dispatchEvent(new CustomEvent(GLOSSARY_OPEN_EVENT, { detail: wrap }));
  const bubble = document.createElement('span');
  bubble.className = 'gloss-bubble';
  const title = document.createElement('strong');
  title.textContent = btn.dataset.term ?? '';
  bubble.append(title, document.createTextNode(btn.dataset.definition ?? ''));
  if (btn.dataset.href) {
    const a = document.createElement('a');
    a.href = btn.dataset.href;
    a.textContent = 'En savoir plus';
    bubble.append(document.createTextNode(' '), a);
  }
  live.replaceChildren(bubble);
  btn.setAttribute('aria-expanded', 'true');
  placeBubble(btn, bubble);
}

export function initGlossary(): void {
  if (ready || typeof document === 'undefined') return;
  ready = true;
  // Sans JavaScript, la définition reste accessible dans l’infobulle native ; avec JavaScript on la retire.
  document.querySelectorAll('.gloss-btn[title]').forEach((b) => b.removeAttribute('title'));

  document.addEventListener('click', (e) => {
    const target = e.target as Element | null;
    const btn = target?.closest?.('.gloss-btn');
    if (btn) {
      const wrap = btn.closest('.gloss');
      if (!wrap || !btn.hasAttribute('data-term')) return; // variante React : gérée par le composant
      if (bubbleOf(wrap)) close(wrap);
      else open(wrap);
      return;
    }
    if (!target?.closest?.('.gloss-bubble')) closeAll();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const openWrap = [...document.querySelectorAll('.gloss')].find((w) => bubbleOf(w));
    if (!openWrap) return;
    const inside = openWrap.contains(document.activeElement);
    close(openWrap, inside || document.activeElement === document.body);
  });
  document.addEventListener('focusout', (e) => {
    const wrap = (e.target as Element | null)?.closest?.('.gloss');
    const next = (e as FocusEvent).relatedTarget as Node | null;
    if (wrap && next && !wrap.contains(next) && bubbleOf(wrap)) close(wrap);
  });
  window.addEventListener('resize', () => {
    document.querySelectorAll('.gloss').forEach((w) => {
      const b = bubbleOf(w);
      const btn = w.querySelector<HTMLElement>('.gloss-btn');
      if (b && btn) placeBubble(btn, b);
    });
  });
}
