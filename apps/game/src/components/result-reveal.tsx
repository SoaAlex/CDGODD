import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  FadeOut,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { RoomCardResult, Side } from '@cdgodd/shared';
import { TallyBar } from '@/components/tally-bar';
import { ThemedText } from '@/components/themed-text';
import {
  Fonts,
  LEFT_COLOR,
  RIGHT_COLOR,
  Spacing,
  TEXT_SHADOW,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';

/** How long the "VOTE RESULTS" splash stays before the first card. */
const SPLASH_MS = 1800;
/** Pause before the tally bar splits from 50/50 to the real result. */
const TALLY_DELAY_MS = 350;
const TALLY_MS = 600;

/** Solid card colors — same opaque white surface as the swipe card. */
const CARD_TEXT = '#1b1b2f';

interface Props {
  results: RoomCardResult[];
  /** Server-synced index of the card everyone is looking at. */
  revealIndex: number;
  /** This player's own votes for the round, indexed by card. */
  myVotes: Side[];
  isHost: boolean;
  onNext: () => void;
  onPrev: () => void;
}

/**
 * Host-paced card-by-card reveal (batch mode): a "VOTE RESULTS" splash, then
 * one card at a time with everyone's votes. The host advances the whole room
 * so players debate the same card; guests just watch the shared index move.
 */
export function ResultReveal({
  results,
  revealIndex,
  myVotes,
  isHost,
  onNext,
  onPrev,
}: Props) {
  const { t } = useT();
  // Splash only when the reveal starts from the top — a late joiner lands
  // straight on the card the room is already debating.
  const [splashing, setSplashing] = useState(() => revealIndex === 0);

  // Which way the last host step moved, so the card slides in from the side
  // it's coming from (back = from the left, forward = from the right).
  const prevRevealIndex = useRef(revealIndex);
  const goingBack = revealIndex < prevRevealIndex.current;
  useEffect(() => {
    prevRevealIndex.current = revealIndex;
  }, [revealIndex]);

  useEffect(() => {
    if (!splashing) return;
    // Timer, not animation callback: reanimated web runs on rAF, which
    // throttled tabs pause — the splash must always give way to the cards.
    const timer = setTimeout(() => setSplashing(false), SPLASH_MS);
    return () => clearTimeout(timer);
  }, [splashing]);

  // Host advanced while this guest was still on the splash: cut it short.
  useEffect(() => {
    if (revealIndex > 0) setSplashing(false);
  }, [revealIndex]);

  const result = results[revealIndex];
  if (!result) return null;

  return (
    <View style={styles.fill}>
      {splashing ? (
        <Splash label={t('multiplayer.voteResults').toUpperCase()} />
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary" style={styles.counter}>
            {revealIndex + 1} / {results.length}
          </ThemedText>
          <View style={styles.stage}>
            {/* Keyed on the index so each advance slides the old card out
                and springs the next one in. */}
            <Animated.View
              key={revealIndex}
              entering={(goingBack ? SlideInLeft : SlideInRight)
                .springify()
                .damping(18)
                .stiffness(160)}
              exiting={(goingBack ? SlideOutRight : SlideOutLeft).duration(200)}
              style={styles.cardSlot}
            >
              <RevealCard result={result} myVote={myVotes[revealIndex]} />
            </Animated.View>
          </View>
          <View style={styles.footer}>
            {isHost ? (
              <View style={styles.hostControls}>
                {revealIndex > 0 && (
                  <Pressable
                    testID="prev-card"
                    onPress={onPrev}
                    accessibilityLabel={t('multiplayer.previousCard')}
                    style={({ pressed }) => [
                      styles.prevButton,
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                    <ThemedText type="subtitle" style={styles.prevText}>
                      {t('multiplayer.previousCard')}
                    </ThemedText>
                  </Pressable>
                )}
                <Pressable
                  testID="next-card"
                  onPress={onNext}
                  style={({ pressed }) => [
                    styles.nextButton,
                    { backgroundColor: RIGHT_COLOR, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <ThemedText type="subtitle" style={styles.nextText}>
                    {revealIndex === results.length - 1
                      ? t('multiplayer.showSummary')
                      : t('multiplayer.nextCard')}
                  </ThemedText>
                  <Ionicons name="arrow-forward" size={22} color="#fff" />
                </Pressable>
              </View>
            ) : (
              <ThemedText themeColor="textSecondary" style={styles.counter}>
                {t('multiplayer.waitingHostReveal')}
              </ThemedText>
            )}
          </View>
        </>
      )}
    </View>
  );
}

/** Big game-style title popping in over the gradient. */
function Splash({ label }: { label: string }) {
  const pop = useSharedValue(0);

  useEffect(() => {
    pop.value = withSpring(1, { damping: 12, stiffness: 120 });
  }, [pop]);

  const style = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ scale: interpolate(pop.value, [0, 1], [0.4, 1]) }],
  }));

  return (
    <View style={[styles.fill, styles.splashWrap]}>
      <Animated.View exiting={FadeOut.duration(250)} style={style}>
        <ThemedText style={styles.splashText}>{label}</ThemedText>
      </Animated.View>
    </View>
  );
}

/** One card's outcome: image, label, animated tally, own vote, voter chips. */
function RevealCard({
  result,
  myVote,
}: {
  result: RoomCardResult;
  myVote: Side | undefined;
}) {
  const { t } = useT();
  const theme = useTheme();
  const { card, votesLeft, votesRight, votersLeft, votersRight } = result;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      {card.imageUrl ? (
        <Image
          source={{ uri: card.imageUrl }}
          style={styles.image}
          contentFit="cover"
          transition={100}
        />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <ThemedText type="title" style={styles.placeholderEmoji}>
            🤔
          </ThemedText>
        </View>
      )}
      <View style={styles.cardBody}>
        <ThemedText
          type="subtitle"
          style={[styles.label, { color: CARD_TEXT }]}
          numberOfLines={2}
        >
          {card.label}
        </ThemedText>
        <RevealTally votesLeft={votesLeft} votesRight={votesRight} />
        {myVote && (
          <View style={styles.myVoteRow}>
            <ThemedText type="small" themeColor="textSecondaryOnSurface">
              {t('history.yourVote')}
            </ThemedText>
            <View
              style={[
                styles.sideBadge,
                { backgroundColor: myVote === 'left' ? LEFT_COLOR : RIGHT_COLOR },
              ]}
            >
              <ThemedText type="small" style={styles.chipText}>
                {myVote === 'left' ? t('game.left') : t('game.right')}
              </ThemedText>
            </View>
          </View>
        )}
        <View style={styles.votersRow}>
          <View style={styles.votersSide}>
            {votersLeft.map((voter, i) => (
              <Animated.View
                key={`${voter}-${i}`}
                entering={FadeInUp.delay(
                  TALLY_DELAY_MS + TALLY_MS / 2 + i * 80,
                ).duration(220)}
                style={[styles.voterChip, { backgroundColor: LEFT_COLOR }]}
              >
                <ThemedText type="small" style={styles.chipText}>
                  {voter}
                </ThemedText>
              </Animated.View>
            ))}
          </View>
          <View style={[styles.votersSide, styles.votersSideRight]}>
            {votersRight.map((voter, i) => (
              <Animated.View
                key={`${voter}-${i}`}
                entering={FadeInUp.delay(
                  TALLY_DELAY_MS + TALLY_MS / 2 + i * 80,
                ).duration(220)}
                style={[styles.voterChip, { backgroundColor: RIGHT_COLOR }]}
              >
                <ThemedText type="small" style={styles.chipText}>
                  {voter}
                </ThemedText>
              </Animated.View>
            ))}
          </View>
        </View>
        {/* Global community tally (all app users), apart from the room's
            votes above — fades in once the room bar has settled. */}
        <Animated.View
          entering={FadeInUp.delay(TALLY_DELAY_MS + TALLY_MS).duration(220)}
          style={styles.globalZone}
        >
          <ThemedText
            type="small"
            themeColor="textSecondaryOnSurface"
            style={styles.globalLabel}
          >
            {t('game.globalVotes')}
          </ThemedText>
          {card.votesLeft + card.votesRight > 0 ? (
            <TallyBar
              tally={{
                itemId: card.id,
                votesLeft: card.votesLeft,
                votesRight: card.votesRight,
              }}
              compact
            />
          ) : (
            <ThemedText
              type="small"
              themeColor="textSecondaryOnSurface"
              style={styles.globalLabel}
            >
              {t('game.noVotesYet')}
            </ThemedText>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

/**
 * Tally bar that starts at 50/50 and visibly splits toward the real result.
 * Remounts with each card (parent is keyed on revealIndex), so the animation
 * replays every time the host advances.
 */
function RevealTally({
  votesLeft,
  votesRight,
}: {
  votesLeft: number;
  votesRight: number;
}) {
  const total = votesLeft + votesRight;
  const leftPct = total === 0 ? 50 : Math.round((votesLeft / total) * 100);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      TALLY_DELAY_MS,
      withTiming(1, { duration: TALLY_MS, easing: Easing.out(Easing.cubic) }),
    );
  }, [progress]);

  const leftStyle = useAnimatedStyle(() => ({
    flex: interpolate(progress.value, [0, 1], [50, leftPct]),
  }));
  const rightStyle = useAnimatedStyle(() => ({
    flex: interpolate(progress.value, [0, 1], [50, 100 - leftPct]),
  }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <View style={styles.tally}>
      <View style={styles.tallyBar}>
        <Animated.View
          style={[styles.tallySegment, { backgroundColor: LEFT_COLOR }, leftStyle]}
        />
        <Animated.View
          style={[styles.tallySegment, { backgroundColor: RIGHT_COLOR }, rightStyle]}
        />
      </View>
      <Animated.View style={[styles.tallyLabels, labelStyle]}>
        <ThemedText type="smallBold" style={{ color: LEFT_COLOR }}>
          {leftPct}% · {votesLeft}
        </ThemedText>
        <ThemedText type="smallBold" style={{ color: RIGHT_COLOR }}>
          {100 - leftPct}% · {votesRight}
        </ThemedText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    gap: Spacing.three,
  },
  splashWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashText: {
    fontFamily: Fonts.display,
    fontWeight: '700',
    fontSize: 44,
    lineHeight: 54,
    letterSpacing: 2,
    textAlign: 'center',
    color: '#ffffff',
    ...TEXT_SHADOW,
  },
  counter: {
    textAlign: 'center',
  },
  stage: {
    flex: 1,
  },
  cardSlot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  card: {
    flex: 1,
    borderRadius: Spacing.four,
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
    elevation: 6,
  },
  image: {
    flex: 1,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef0f6',
  },
  placeholderEmoji: {
    fontSize: 96,
    lineHeight: 120,
  },
  cardBody: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  label: {
    textAlign: 'center',
    fontSize: 26,
    lineHeight: 34,
  },
  tally: {
    gap: Spacing.one,
  },
  tallyBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  tallySegment: {
    minWidth: 4,
  },
  tallyLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  myVoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  sideBadge: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
  },
  votersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  votersSide: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  votersSideRight: {
    justifyContent: 'flex-end',
  },
  globalZone: {
    marginTop: Spacing.one,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(27, 27, 47, 0.2)',
    gap: Spacing.half,
  },
  globalLabel: {
    textAlign: 'center',
  },
  voterChip: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
  },
  chipText: {
    color: '#fff',
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    minHeight: 56,
    justifyContent: 'center',
  },
  hostControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.six,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  nextText: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 28,
  },
  prevButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  prevText: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 28,
  },
});
