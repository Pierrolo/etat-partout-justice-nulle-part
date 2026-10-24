/** Move keyboard focus to the first control of the question behind an error key (`adult0.age`, `housing.zone`…). */
export function focusField(key: string): void {
  const wrap = document.querySelector<HTMLElement>(`[data-field="${key}"]`);
  const target = wrap?.querySelector<HTMLElement>('input:not([disabled]):not([type="hidden"])');
  if (!target) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  target.focus({ preventScroll: true });
}
