import { Asset } from 'expo-asset';

const MUTE_KEY = 'cdgodd.music_muted';

let audio: HTMLAudioElement | null = null;
let muted = readMuted();
let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let freqData: Uint8Array<ArrayBuffer> | null = null;

/**
 * Route the element through an AnalyserNode so the UI can react to the beat.
 * Must only run after a successful play() (user gesture happened): creating
 * the context earlier would leave it suspended and silence the element.
 */
function ensureAnalyser(): void {
  if (analyser || !audio) return;
  try {
    audioCtx = new AudioContext();
    const source = audioCtx.createMediaElementSource(audio);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    freqData = new Uint8Array(analyser.frequencyBinCount);
  } catch {
    analyser = null; // analysis is optional; never break playback
  }
}

/**
 * Current low-frequency (bass/kick) energy of the playing music, 0..1.
 * `null` when unavailable: muted, paused, autoplay-blocked, or native.
 */
export function readMusicLevel(): number | null {
  if (!audio || muted || audio.paused || !analyser || !freqData) return null;
  if (audioCtx && audioCtx.state !== 'running') {
    void audioCtx.resume();
    return null;
  }
  analyser.getByteFrequencyData(freqData);
  let sum = 0;
  const bins = 8; // lowest bins ≈ 0–1.4kHz where the kick lives
  for (let i = 0; i < bins; i++) sum += freqData[i] ?? 0;
  return sum / bins / 255;
}

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
    audio?.play().then(ensureAnalyser).catch(() => {
      // Autoplay blocked — wait for the first user gesture.
      const onGesture = () => {
        if (!muted) void audio?.play().then(ensureAnalyser).catch(() => {});
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
    void audio.play().then(ensureAnalyser).catch(() => {});
  }
}
