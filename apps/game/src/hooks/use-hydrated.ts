import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

/**
 * False during static-export server rendering AND the client's hydration
 * render, true afterwards. Gate any viewport-dependent conditional rendering
 * on this: useWindowDimensions reads 0×0 on the server but the real window
 * during hydration, so an ungated `width > 0 && …` branch produces different
 * trees and triggers React hydration error #418.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
