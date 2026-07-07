import type { ReactNode } from 'react';

/** Native: side ad rails are a desktop-web concept — plain passthrough. */
export function AdRails({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
