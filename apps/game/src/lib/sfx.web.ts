import { Asset } from 'expo-asset';
import type { Side } from '@cdgodd/shared';

/**
 * Web only: short one-shot sound on each swipe. Left plays the Marseillaise
 * clip, right plays the anthem clip. Elements are created once and rewound
 * before each play so rapid swipes retrigger the sound instead of ignoring it.
 */
let left: HTMLAudioElement | null = null;
let right: HTMLAudioElement | null = null;

const MUTE_KEY = 'cdgodd.sfx_muted';
let muted = readMuted();
let suspended = false;

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function isSfxMuted(): boolean {
  return muted;
}

export function setSfxMuted(next: boolean): void {
  muted = next;
  try {
    window.localStorage.setItem(MUTE_KEY, next ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/**
 * Silence effects for a full-screen ad, cutting any clip still playing (the
 * swipe that triggers an ad break also fires its sound). Separate from
 * setSfxMuted so an ad never rewrites the player's saved preference.
 */
export function setSfxSuspended(next: boolean): void {
  suspended = next;
  if (next) {
    left?.pause();
    right?.pause();
  }
}

function make(uri: string): HTMLAudioElement {
  const audio = new window.Audio(uri);
  audio.volume = 0.6;
  return audio;
}

export function playSwipeSound(side: Side): void {
  if (muted || suspended) return;
  if (!left) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    left = make(Asset.fromModule(require('../../assets/audio/m-republique.mp3')).uri);
  }
  if (!right) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    right = make(Asset.fromModule(require('../../assets/audio/z-hem.mp3')).uri);
  }
  const audio = side === 'left' ? left : right;
  audio.currentTime = 0;
  void audio.play().catch(() => {});
}
