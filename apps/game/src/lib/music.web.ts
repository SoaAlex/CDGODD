import { Asset } from 'expo-asset';

const MUTE_KEY = 'cdgodd.music_muted';

let audio: HTMLAudioElement | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Web only: loop the theme song for the whole session. Browsers block
 * audible autoplay until the user interacts with the page, so if the
 * first play() is rejected we retry on the first pointer/key event.
 */
export function startBackgroundMusic(): void {
  if (audio) return;
  const uri = Asset.fromModule(
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../../assets/audio/tous-les-francais-house.mp3'),
  ).uri;

  audio = new window.Audio(uri);
  audio.loop = true;
  audio.volume = 0.35;
  if (muted) return; // created but paused; unmute starts it

  const tryPlay = () => {
    audio?.play().catch(() => {
      // Autoplay blocked — wait for the first user gesture.
      const onGesture = () => {
        if (!muted) void audio?.play().catch(() => {});
        window.removeEventListener('pointerdown', onGesture);
        window.removeEventListener('keydown', onGesture);
      };
      window.addEventListener('pointerdown', onGesture);
      window.addEventListener('keydown', onGesture);
    });
  };
  tryPlay();
}

export function isMusicMuted(): boolean {
  return muted;
}

export function setMusicMuted(next: boolean): void {
  muted = next;
  try {
    window.localStorage.setItem(MUTE_KEY, next ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (!audio) return;
  if (next) {
    audio.pause();
  } else {
    void audio.play().catch(() => {});
  }
}
