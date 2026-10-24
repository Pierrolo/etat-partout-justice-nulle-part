import { useEffect, useRef, useState } from 'react';

/**
 * Pixel width of a container, for SVG charts that need real pixels (text must stay 12–13 px on a
 * phone, so a scaled viewBox is not an option). `initial` is what the server renders; the real width
 * replaces it right after hydration.
 */
export function useWidth<T extends HTMLElement>(initial = 720) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(240, Math.floor(el.getBoundingClientRect().width)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** True when the visitor asks for less motion. Safe on the server (returns true: no animation). */
export function prefersReducedMotion(): boolean {
  return (
    typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
