import type { Side } from '@cdgodd/shared';

/** Native: swipe sound effects are a web-only flourish for now. */
export function playSwipeSound(_side: Side): void {}

export function isSfxMuted(): boolean {
  return false;
}

export function setSfxMuted(_next: boolean): void {}
