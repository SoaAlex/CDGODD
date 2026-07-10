import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';

/** Trailing separator gives the loop some air between repetitions. */
const TRACK =
  'CHIRAC - Je serai le président de tous les Français (TOMALY House remix) — Tomaly x Malto • ';

/** Marquee speed in px/s. */
const SPEED = 30;

/**
 * Tiny "now playing" marquee shown next to the mute button on the home
 * screen: a music icon plus the theme song's title scrolling in a narrow
 * window. Tapping it opens the credits screen. Web only — music doesn't
 * play on native.
 */
export function NowPlaying() {
  const { t } = useT();
  const theme = useTheme();
  const router = useRouter();
  const [textWidth, setTextWidth] = useState(0);
  const reducedMotion = useReducedMotion();
  const offset = useSharedValue(0);

  useEffect(() => {
    if (!textWidth || reducedMotion) {
      cancelAnimation(offset);
      offset.value = 0;
      return;
    }
    offset.value = 0;
    offset.value = withRepeat(
      withTiming(-textWidth, {
        duration: (textWidth / SPEED) * 1000,
        easing: Easing.linear,
      }),
      -1,
    );
  }, [textWidth, reducedMotion, offset]);

  const scrollStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  if (Platform.OS !== 'web') return null;

  return (
    <Pressable
      testID="now-playing"
      accessibilityLabel={t('menu.credits')}
      onPress={() => router.push('/credits')}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name="musical-notes" size={14} color={theme.textSecondary} />
      <View style={styles.window}>
        <Animated.View style={[styles.track, scrollStyle]}>
          {/* Two copies so the loop wraps without a gap. No numberOfLines:
              it caps the text at the window's width, which would truncate
              the marquee — the nowrap style keeps it on one line instead. */}
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.text}
            onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
          >
            {TRACK}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
            {TRACK}
          </ThemedText>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: Spacing.two,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  window: {
    width: 140,
    overflow: 'hidden',
  },
  track: {
    flexDirection: 'row',
  },
  text: {
    fontSize: 12,
    lineHeight: 18,
    flexShrink: 0,
    // Web-only component; RN types don't know the web-only nowrap value.
    whiteSpace: 'nowrap',
  } as object,
});
