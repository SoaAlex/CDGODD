import { Asset } from 'expo-asset';
import type { Side } from '@cdgodd/shared';

/**
 * Web only: short one-shot sound on each swipe. Left plays the Marseillaise
 * clip, right plays the anthem clip. Elements are created once and rewound
 * before each play so rapid swipes retrigger the sound instead of ignoring it.
 */
let left: HTMLAudioElement | null = null;
let right: HTMLAudioElement | null = null;

function make(uri: string): HTMLAudioElement {
  const audio = new window.Audio(uri);
  audio.volume = 0.6;
  return audio;
}

export function playSwipeSound(side: Side): void {
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
