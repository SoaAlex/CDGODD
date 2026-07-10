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

import { useHydrated } from '@/hooks/use-hydrated';

/**
 * One aurora blob: a soft radial-gradient circle drifting slowly across the
 * screen. Positions and drift are fractions of the window so the layout
 * scales from phones to wide desktop viewports.
 */
interface BlobConfig {
  color: string;
  /** Diameter as a fraction of max(width, height). */
  size: number;
  /** Rest position of the top-left corner (fractions of window size). */
  x0: number;
  y0: number;
  /** Drift amplitude (fractions of window size). */
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

// Colors stay in the purple-brand family (theme Gradient #667eea → #764ba2);
// max center opacity 0.45 keeps white text + TEXT_SHADOW legible on top.
const BLOBS: BlobConfig[] = [
  { color: '#7dd3fc', size: 0.9,  x0: -0.25, y0: -0.15, dx: 0.18,  dy: 0.12,  durX: 34000, durY: 26000, durScale: 30000, scaleMin: 0.9,  scaleMax: 1.15, opacity: 0.4,  phase: 0 },
  { color: '#c084fc', size: 1.1,  x0: 0.55,  y0: 0.05,  dx: -0.15, dy: 0.18,  durX: 38000, durY: 30000, durScale: 24000, scaleMin: 0.85, scaleMax: 1.1,  opacity: 0.45, phase: 0.35 },
  { color: '#f0abfc', size: 0.75, x0: 0.15,  y0: 0.55,  dx: 0.16,  dy: -0.14, durX: 28000, durY: 36000, durScale: 32000, scaleMin: 0.9,  scaleMax: 1.2,  opacity: 0.35, phase: 0.65 },
  { color: '#818cf8', size: 1.0,  x0: -0.1,  y0: 0.7,   dx: 0.14,  dy: -0.16, durX: 40000, durY: 24000, durScale: 28000, scaleMin: 0.9,  scaleMax: 1.1,  opacity: 0.45, phase: 0.9 },
];

function AuroraBlob({
  blob,
  id,
  width,
  height,
  animate,
}: {
  blob: BlobConfig;
  /** Unique per blob — SVG gradient ids share one DOM on web. */
  id: string;
  width: number;
  height: number;
  animate: boolean;
}) {
  const size = blob.size * Math.max(width, height);
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
    transform: [
      { translateX: (blob.x0 + px.value * blob.dx) * width },
      { translateY: (blob.y0 + py.value * blob.dy) * height },
      { scale: blob.scaleMin + ps.value * (blob.scaleMax - blob.scaleMin) },
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
 * backgrounded.
 */
export function AuroraBlobs() {
  // Two size sources because each fails alone on web: during static-export
  // hydration useWindowDimensions reads 0×0 and never emits a change, while
  // onLayout (rAF-scheduled on web) doesn't fire while the tab is hidden.
  // Prefer the measured layout (the actual painted area), fall back to the
  // window.
  const win = useWindowDimensions();
  // Server renders no blobs (0×0 window); the client must render the same
  // empty tree during hydration or React reports mismatch #418.
  const hydrated = useHydrated();
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const width = layout.width || win.width;
  const height = layout.height || win.height;
  const reducedMotion = useReducedMotion();
  const [appActive, setAppActive] = useState(true);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
    });
    return () => sub.remove();
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  };

  return (
    <View aria-hidden style={styles.container} onLayout={onLayout}>
      {hydrated &&
        width > 0 &&
        height > 0 &&
        BLOBS.map((blob, i) => (
          <AuroraBlob
            key={i}
            id={`aurora-${i}`}
            blob={blob}
            width={width}
            height={height}
            animate={!reducedMotion && appActive}
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
