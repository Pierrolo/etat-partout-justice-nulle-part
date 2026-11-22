import { useSyncExternalStore } from 'react';
import { currentColorMode, type ColorMode } from '@/lib/chart-theme';

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', onChange);
  // the theme toggle writes <html data-theme="light|dark">
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => {
    mq.removeEventListener('change', onChange);
    mo.disconnect();
  };
}

/**
 * Current colour mode ('light' | 'dark'), reactive to the OS setting and to the theme toggle.
 * Only needed when a chart uses RESOLVED colours (continuous interpolators, canvas export):
 * charts that use `var(--…)` colours (`css.*` in chart-theme.ts) follow the theme on their own.
 *   const mode = useColorMode();
 *   const color = useMemo(() => divergingInterpolator(mode), [mode]);
 */
export function useColorMode(): ColorMode {
  return useSyncExternalStore(subscribe, currentColorMode, () => 'light');
}
