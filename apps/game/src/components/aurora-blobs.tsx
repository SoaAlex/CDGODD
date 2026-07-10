import { useEffect, useState } from 'react';
import {
  AppState,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { readMusicLevel } from '@/lib/music';
import { useAuroraPulse } from '@/lib/prefs';

/**
 * One aurora blob: a soft radial-gradient circle drifting slowly across the
 * screen. Positions and drift are fractions of the window so the layout
 * scales from phones to ultrawide desktop viewports.
 */
interface BlobConfig {
  color: string;
  /** Diameter as a fraction of (width + height) / 2. */
  size: number;
  /** Rest position of the blob CENTER (fractions of window size). */
  cx: number;
  cy: number;
  /** Drift amplitude of the center (fractions of window size). */
  dx: number;
  dy: number;
  /** Loop durations (ms) — distinct per axis for organic Lissajous paths. */
  durX: number;
  durY: number;
  durScale: number;
  scaleMin: number;
  scaleMax: number;
  /** Gradient center opacity; edges always fade to 0. */
  opacity: number;
  /** Initial animation phase in [0, 1] so blobs start desynchronized. */
  phase: number;
}

// Colors stay in the purple-brand family (theme Gradient #667eea → #764ba2).
// Centers are placed as screen fractions so every blob stays visible on any
// aspect ratio (phones and ultrawide monitors alike).
const BLOBS: BlobConfig[] = [
  { color: '#7dd3fc', size: 0.9,  cx: 0.1,  cy: 0.05, dx: 0.45, dy: 0.3,   durX: 12000, durY: 9000,  durScale: 10000, scaleMin: 0.85, scaleMax: 1.2,  opacity: 0.7,  phase: 0 },
  { color: '#c084fc', size: 1.1,  cx: 0.9,  cy: 0.1,  dx: -0.4, dy: 0.35,  durX: 13000, durY: 10000, durScale: 8000,  scaleMin: 0.8,  scaleMax: 1.15, opacity: 0.75, phase: 0.35 },
  { color: '#f0abfc', size: 0.75, cx: 0.3,  cy: 0.65, dx: 0.5,  dy: -0.3,  durX: 10000, durY: 13000, durScale: 11000, scaleMin: 0.85, scaleMax: 1.25, opacity: 0.65, phase: 0.65 },
  { color: '#818cf8', size: 1.0,  cx: 0.15, cy: 0.9,  dx: 0.4,  dy: -0.35, durX: 14000, durY: 9000,  durScale: 10000, scaleMin: 0.85, scaleMax: 1.15, opacity: 0.75, phase: 0.9 },
];

/** How often the music level is sampled while the pulse is active (ms). */
const BEAT_POLL_MS = 90;

function AuroraBlob({
  blob,
  id,
  width,
  height,
  animate,
  beat,
}: {
  blob: BlobConfig;
  /** Unique per blob — SVG gradient ids share one DOM on web. */
  id: string;
  width: number;
  height: number;
  animate: boolean;
  /** 1 = full brightness; dips toward 0 blink the blob. */
  beat: SharedValue<number>;
}) {
  const size = blob.size * ((width + height) / 2);
  const px = useSharedValue(blob.phase);
  const py = useSharedValue(1 - blob.phase);
  const ps = useSharedValue(blob.phase);

  useEffect(() => {
    if (!animate) {
      cancelAnimation(px);
      cancelAnimation(py);
      cancelAnimation(ps);
      return;
    }
    // Ramp from the current value to 1 first, then loop over the full 1↔0
    // range — withRepeat(reverse) alone would only oscillate between the
    // initial value and 1, freezing any blob whose phase starts near 1.
    const drift = (v: SharedValue<number>, duration: number) => {
      v.value = withSequence(
        withTiming(1, {
          duration: duration * (1 - v.value),
          easing: Easing.inOut(Easing.sin),
        }),
        withRepeat(
          withTiming(0, { duration, easing: Easing.inOut(Easing.sin) }),
          -1,
          true,
        ),
      );
    };
    drift(px, blob.durX);
    drift(py, blob.durY);
    drift(ps, blob.durScale);
  }, [animate, blob, px, py, ps]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.72 + 0.28 * beat.value,
    transform: [
      { translateX: blob.cx * width - size / 2 + px.value * blob.dx * width },
      { translateY: blob.cy * height - size / 2 + py.value * blob.dy * height },
      {
        scale:
          (blob.scaleMin + ps.value * (blob.scaleMax - blob.scaleMin)) *
          (1 + 0.06 * (beat.value - 1)),
      },
    ],
  }));

  return (
    <Animated.View
      renderToHardwareTextureAndroid
      style={[styles.blob, { width: size, height: size }, animatedStyle]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={blob.color} stopOpacity={blob.opacity} />
            <Stop offset="0.5" stopColor={blob.color} stopOpacity={blob.opacity * 0.35} />
            <Stop offset="1" stopColor={blob.color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/**
 * Ambient aurora / lava-lamp layer rendered between the brand gradient and
 * the screens. Transform-only animations (UI thread / CSS transforms on web);
 * honors reduced-motion (blobs render static) and pauses while the app is
 * backgrounded. When the "aurora pulse" preference is on, blobs blink to the
 * music's bass energy (web) or at random intervals when no music is playing.
 */
export function AuroraBlobs() {
  // Two size sources because each fails alone on web: during static-export
  // hydration useWindowDimensions reads 0×0 and never emits a change, while
  // onLayout (rAF-scheduled on web) doesn't fire while the tab is hidden.
  // Prefer the measured layout (the actual painted area), fall back to the
  // window.
  const win = useWindowDimensions();
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const width = layout.width || win.width;
  const height = layout.height || win.height;
  const reducedMotion = useReducedMotion();
  const [appActive, setAppActive] = useState(true);
  const { auroraPulse } = useAuroraPulse();
  // 1 = full brightness. Music drives it continuously; the random fallback
  // dips it briefly. Idles at 1 so the pulse-off look is unchanged.
  const beat = useSharedValue(1);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
    });
    return () => sub.remove();
  }, []);

  const pulseActive = auroraPulse && !reducedMotion && appActive;
  useEffect(() => {
    if (!pulseActive) {
      cancelAnimation(beat);
      beat.value = withTiming(1, { duration: 400 });
      return;
    }
    // Music available: follow the bass energy so the blobs dance on the kick.
    // The raw level sits in a narrow, track-dependent band, so normalize it
    // against a running min/max envelope (fast attack, slow release) to use
    // the full 0..1 blink range regardless of track section or volume.
    let lo = 1;
    let hi = 0;
    const poll = setInterval(() => {
      const level = readMusicLevel();
      if (level !== null) {
        lo += (level - lo) * (level < lo ? 0.5 : 0.005);
        hi += (level - hi) * (level > hi ? 0.5 : 0.005);
        const range = hi - lo;
        const target =
          range > 0.02 ? Math.min(1, Math.max(0, (level - lo) / range)) : 1;
        beat.value = withTiming(target, { duration: BEAT_POLL_MS });
      }
    }, BEAT_POLL_MS);
    // No music (native, muted, autoplay-blocked): blink at random intervals.
    let timer: ReturnType<typeof setTimeout>;
    const scheduleRandomBlink = () => {
      timer = setTimeout(() => {
        if (readMusicLevel() === null) {
          beat.value = withSequence(
            withTiming(0, { duration: 140, easing: Easing.out(Easing.quad) }),
            withTiming(1, { duration: 480, easing: Easing.in(Easing.quad) }),
          );
        }
        scheduleRandomBlink();
      }, 1600 + Math.random() * 2800);
    };
    scheduleRandomBlink();
    return () => {
      clearInterval(poll);
      clearTimeout(timer);
    };
  }, [pulseActive, beat]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setLayout((prev) =>
      prev.width === w && prev.height === h ? prev : { width: w, height: h },
    );
  };

  return (
    <View aria-hidden style={styles.container} onLayout={onLayout}>
      {width > 0 &&
        height > 0 &&
        BLOBS.map((blob, i) => (
          <AuroraBlob
            key={i}
            id={`aurora-${i}`}
            blob={blob}
            width={width}
            height={height}
            animate={!reducedMotion && appActive}
            beat={beat}
          />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    pointerEvents: 'none',
    // Blobs extend past the window edges; without this the web page grows
    // scrollbars.
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
