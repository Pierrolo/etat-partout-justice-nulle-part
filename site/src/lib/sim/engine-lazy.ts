/**
 * The calculation engine is a separate, lazily loaded chunk: the questions (what the visitor sees first)
 * need none of it, so the page becomes interactive on roughly half of the JavaScript. It starts loading as
 * soon as the island is hydrated — long before the last question is answered — and a shared link waits for
 * it behind the « Chargement de la simulation partagée… » notice.
 */
import { useEffect, useState } from 'react';

export type EngineModule = typeof import('@/lib/engine');

let promise: Promise<EngineModule> | null = null;
let loaded: EngineModule | null = null;

export function loadEngine(): Promise<EngineModule> {
  promise ??= import('@/lib/engine').then((m) => {
    loaded = m;
    return m;
  });
  return promise;
}

/** `null` on the server, on the first client render (no hydration mismatch) and until the chunk arrives. */
export function useEngine(): EngineModule | null {
  const [engine, setEngine] = useState<EngineModule | null>(null);
  useEffect(() => {
    let live = true;
    if (loaded) setEngine(loaded);
    else
      loadEngine().then(
        (m) => live && setEngine(m),
        () => undefined,
      );
    return () => {
      live = false;
    };
  }, []);
  return engine;
}
