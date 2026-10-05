'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * True while the CSS media query matches. Returns false during server rendering,
 * so layouts should be mobile-first and only *enhance* when this turns true.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const mq = window.matchMedia(query);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}
