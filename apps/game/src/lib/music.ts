/** Native: no background music — it's a web-only flourish. */
export function startBackgroundMusic(): void {}

export function isMusicMuted(): boolean {
  return false;
}

export function setMusicMuted(_next: boolean): void {}
