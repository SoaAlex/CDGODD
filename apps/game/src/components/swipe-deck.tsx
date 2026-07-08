import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { DeckCard, Side } from '@cdgodd/shared';
import { LEFT_COLOR, RIGHT_COLOR, SwipeCard } from '@/components/swipe-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { playSwipeSound } from '@/lib/sfx';

/** Horizontal travel (as a fraction of screen width) that commits a vote. */
const COMMIT_RATIO = 0.35;
/** Exit animation duration; also the vote-commit delay. */
const EXIT_MS = 220;

interface Props {
  cards: DeckCard[];
  onSwipe: (side: Side) => void;
}

export interface SwipeDeckHandle {
  /** Animate the top card off-screen and commit the vote (button path). */
  swipeOut: (side: Side) => void;
}

/**
 * Tinder-style deck. Only the top card is interactive; the next card sits
 * underneath, slightly scaled down, and pops up when the top one leaves.
 */
export const SwipeDeck = forwardRef<SwipeDeckHandle, Props>(function SwipeDeck(
  { cards, onSwipe }: Props,
  ref,
) {
  const { width } = useWindowDimensions();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  const top = cards[0];
  const next = cards[1];

  // Each exit animation gets an id; commit runs at most once per id
  // (reanimated completion callbacks can fire more than once on web dev,
  // and cancelled animations also invoke the callback).
  const swipeId = useRef(0);
  const committedId = useRef(-1);

  const commit = (side: Side, id: number) => {
    if (committedId.current >= id) return;
    committedId.current = id;
    onSwipe(side);
    tx.value = 0;
    ty.value = 0;
  };

  const swipeOut = (side: Side) => {
    const id = ++swipeId.current;
    playSwipeSound(side);
    tx.value = withTiming((side === 'right' ? 1 : -1) * width * 1.5, {
      duration: EXIT_MS,
    });
    // Commit on a timer, never on the animation callback: reanimated web
    // drives animations with requestAnimationFrame, which throttled or
    // backgrounded tabs pause — the exit animation is decoration, the vote
    // must not depend on it.
    setTimeout(() => commit(side, id), EXIT_MS);
  };

  useImperativeHandle(ref, () => ({ swipeOut }));

  const pan = Gesture.Pan()
    .onChange((e) => {
      tx.value += e.changeX;
      ty.value += e.changeY;
    })
    .onEnd((e) => {
      const threshold = width * COMMIT_RATIO;
      const flung = Math.abs(e.velocityX) > 800;
      if (Math.abs(tx.value) > threshold || flung) {
        const side: Side = tx.value > 0 || (flung && e.velocityX > 0)
          ? 'right'
          : 'left';
        // Route through swipeOut so every exit shares the same commit guard.
        runOnJS(swipeOut)(side);
      } else {
        tx.value = withSpring(0);
        ty.value = withSpring(0);
      }
    });

  const topStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${interpolate(tx.value, [-width, width], [-12, 12])}deg` },
    ],
  }));

  const nextStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.abs(tx.value) / (width * COMMIT_RATIO), 1);
    return {
      transform: [{ scale: interpolate(progress, [0, 1], [0.94, 1]) }],
      opacity: interpolate(progress, [0, 1], [0.7, 1]),
    };
  });

  const leftBadge = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [-width * COMMIT_RATIO, 0], [1, 0], 'clamp'),
  }));
  const rightBadge = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [0, width * COMMIT_RATIO], [0, 1], 'clamp'),
  }));

  if (!top) return null;

  return (
    <View style={styles.stack}>
      {next && (
        <Animated.View style={[styles.cardSlot, nextStyle]}>
          <SwipeCard card={next} />
        </Animated.View>
      )}
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.cardSlot, topStyle]}>
          <SwipeCard card={top} />
          <Animated.View
            style={[styles.badge, styles.badgeLeft, leftBadge, styles.noPointer]}
          >
            <ThemedText type="subtitle" style={styles.badgeText}>
              {t('game.left').toUpperCase()}
            </ThemedText>
          </Animated.View>
          <Animated.View
            style={[styles.badge, styles.badgeRight, rightBadge, styles.noPointer]}
          >
            <ThemedText type="subtitle" style={styles.badgeText}>
              {t('game.right').toUpperCase()}
            </ThemedText>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  stack: {
    flex: 1,
  },
  cardSlot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  badge: {
    position: 'absolute',
    top: Spacing.five,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 3,
    borderColor: '#fff',
  },
  badgeLeft: {
    left: Spacing.five,
    backgroundColor: LEFT_COLOR,
    transform: [{ rotate: '-12deg' }],
  },
  badgeRight: {
    right: Spacing.five,
    backgroundColor: RIGHT_COLOR,
    transform: [{ rotate: '12deg' }],
  },
  badgeText: {
    color: '#fff',
  },
  noPointer: {
    pointerEvents: 'none',
  },
});
