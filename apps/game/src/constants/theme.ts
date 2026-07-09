/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/** Purple brand gradient (from the original web app). */
export const Gradient = ['#667eea', '#764ba2'] as const;

/** Purple accent matching the gradient. */
export const ACCENT_COLOR = '#667eea';

/**
 * French political colors: gauche = red, droite = blue (from the original web
 * app). Used as fills for buttons, chips and bar segments — brand look is
 * deliberately kept over strict WCAG ratios for white content on top.
 */
export const LEFT_COLOR = '#e2523a';
export const RIGHT_COLOR = '#6db0f8';

/**
 * Slightly lightened tints of the brand colors for *text* sitting directly on
 * the purple gradient — the saturated fills have nearly the same luminance as
 * the gradient (≈1:1 contrast) and disappear. Pair with {@link TEXT_SHADOW}.
 */
export const LEFT_TEXT_COLOR = '#f47b66';
export const RIGHT_TEXT_COLOR = '#85c2ff';

/** Subtle dark halo that lifts tinted text off the mid-tone gradient. */
export const TEXT_SHADOW = {
  textShadowColor: 'rgba(0, 0, 0, 0.35)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
} as const;

/**
 * Single fixed palette tuned to sit on top of {@link Gradient}: transparent
 * screen backgrounds so the gradient shows through, white text, and frosted
 * "glass" surfaces. Light and dark point to the same values — the app keeps the
 * gradient look regardless of the OS color scheme.
 */
const palette = {
  text: '#ffffff',
  background: 'transparent',
  backgroundElement: 'rgba(255, 255, 255, 0.16)',
  backgroundSelected: 'rgba(255, 255, 255, 0.28)',
  textSecondary: 'rgba(255, 255, 255, 0.75)',
} as const;

export const Colors = {
  light: palette,
  dark: palette,
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * App fonts. One ClashGrotesk variable family for every role, matching the
 * web app (weight is set via fontWeight in the text styles).
 */
const CLASH = 'ClashGrotesk-Variable';
export const Fonts = {
  /** Body / UI text. */
  sans: CLASH,
  /** Headings, buttons, emphasis. */
  sansMedium: CLASH,
  /** Airy variant for secondary text. */
  sansLight: CLASH,
  /** Display font for the game title. */
  display: CLASH,
  mono: Platform.select({ ios: 'ui-monospace', default: 'monospace' }),
};

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
