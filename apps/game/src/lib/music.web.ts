import { Asset } from 'expo-asset';

let audio: HTMLAudioElement | null = null;

/**
 * Web only: loop the theme song for the whole session. Browsers block
 * audible autoplay until the user interacts with the page, so if the
 * first play() is rejected we retry on the first pointer/key event.
 */
export function startBackgroundMusic(): void {
  if (audio) return;
  const uri = Asset.fromModule(
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../../assets/audio/tous-les-francais.mp3'),
  ).uri;

  audio = new window.Audio(uri);
  audio.loop = true;
  audio.volume = 0.35;

  const tryPlay = () => {
    audio?.play().catch(() => {
      // Autoplay blocked — wait for the first user gesture.
      const onGesture = () => {
        void audio?.play().catch(() => {});
        window.removeEventListener('pointerdown', onGesture);
        window.removeEventListener('keydown', onGesture);
      };
      window.addEventListener('pointerdown', onGesture);
      window.addEventListener('keydown', onGesture);
    });
  };
  tryPlay();
}
