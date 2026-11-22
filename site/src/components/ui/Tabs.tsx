import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  /** Accessible name of the tab list (« Affichage du graphique »). */
  label: string;
  defaultTab?: string;
  /** Controlled mode. */
  value?: string;
  onValueChange?: (id: string) => void;
  /** Keep inactive panels mounted (hidden) — useful when they hold state or charts. */
  keepMounted?: boolean;
  className?: string;
}

/**
 * OWID-style tabs (Graphique · Tableau · Sources). WAI-ARIA tabs pattern, automatic activation:
 * ← → move, Home / End jump, Tab goes to the panel. Needs hydration (`client:load` / `client:visible`);
 * before hydration only the default panel is visible.
 */
export function Tabs({
  tabs,
  label,
  defaultTab,
  value,
  onValueChange,
  keepMounted = false,
  className,
}: TabsProps) {
  const uid = useId();
  const [inner, setInner] = useState(defaultTab ?? tabs[0]?.id ?? '');
  const active = value ?? inner;
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const select = (id: string, focus = false) => {
    if (value === undefined) setInner(id);
    onValueChange?.(id);
    if (focus) refs.current[id]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.id === active);
    if (i < 0) return;
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next >= 0) {
      e.preventDefault();
      select(tabs[next]!.id, true);
    }
  };

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="-mb-px flex gap-1 overflow-x-auto border-b border-rule"
      >
        {tabs.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={`${uid}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${uid}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(t.id)}
              className={cn(
                'min-h-11 shrink-0 cursor-pointer border-b-2 px-3.5 text-[0.9375rem] font-semibold transition-colors',
                selected
                  ? 'border-accent text-ink'
                  : 'border-transparent text-ink-3 hover:text-ink',
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => {
        const selected = t.id === active;
        if (!selected && !keepMounted) return null;
        return (
          <div
            key={t.id}
            role="tabpanel"
            id={`${uid}-panel-${t.id}`}
            aria-labelledby={`${uid}-tab-${t.id}`}
            hidden={!selected}
            tabIndex={0}
            className="pt-4 focus-visible:rounded-md"
          >
            {t.content}
          </div>
        );
      })}
    </div>
  );
}
