import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { GLOSSARY_OPEN_EVENT, lookupTerm, placeBubble, termHref } from '@/lib/glossary';
import './glossary.css';

export interface TermProps {
  /** Identifiant (ou alias) de `data/glossaire.json` : « afu », « csg », « zones »… */
  id: string;
  /** Texte affiché dans la phrase (« AFU », « la CSG »…). */
  children: ReactNode;
}

/**
 * Terme du glossaire : texte souligné en pointillés qui, au clic ou au tap, ouvre une bulle de
 * définition (toggletip). Jamais réservé au survol. Échap ferme et rend le focus au bouton.
 *
 *   <p>Le plan crée l’<Term id="afu">AFU</Term>…</p>
 *
 * Dans une page Astro sans île React, utiliser `<GlossaryTerm>` (même balisage, même rendu).
 * Un identifiant inconnu rend simplement le texte, sans bulle (et signale l’erreur en dev).
 */
export function Term({ id, children }: TermProps) {
  const entry = lookupTerm(id);
  const uid = useId();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (open && btnRef.current && bubbleRef.current) placeBubble(btnRef.current, bubbleRef.current);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const inside = wrapRef.current?.contains(document.activeElement);
      setOpen(false);
      if (inside || document.activeElement === document.body) btnRef.current?.focus();
    };
    const onPointer = (e: Event) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget as Node | null;
      if (next && !wrapRef.current?.contains(next)) close();
    };
    const onOther = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== uid) close();
    };
    const onResize = () => {
      if (btnRef.current && bubbleRef.current) placeBubble(btnRef.current, bubbleRef.current);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener(GLOSSARY_OPEN_EVENT, onOther);
    window.addEventListener('resize', onResize);
    const wrap = wrapRef.current;
    wrap?.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener(GLOSSARY_OPEN_EVENT, onOther);
      window.removeEventListener('resize', onResize);
      wrap?.removeEventListener('focusout', onFocusOut);
    };
  }, [open, uid]);

  if (!entry) {
    if (import.meta.env?.DEV) console.warn(`[Glossary] identifiant inconnu : « ${id} »`);
    return <>{children}</>;
  }

  const liveId = `gloss-${uid.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const href = termHref(entry);
  return (
    <span className="gloss" ref={wrapRef} data-gloss={entry.id}>
      <button
        ref={btnRef}
        type="button"
        className="gloss-btn"
        aria-expanded={open}
        aria-controls={liveId}
        onClick={() => {
          if (!open) document.dispatchEvent(new CustomEvent(GLOSSARY_OPEN_EVENT, { detail: uid }));
          setOpen((o) => !o);
        }}
      >
        {children}
        <span className="sr-only"> (définition)</span>
      </button>
      <span id={liveId} className="gloss-live" role="status">
        {open && (
          <span ref={bubbleRef} className="gloss-bubble">
            <strong>{entry.term}</strong>
            {entry.definition}
            {href && (
              <>
                {' '}
                <a href={href}>En savoir plus</a>
              </>
            )}
          </span>
        )}
      </span>
    </span>
  );
}
