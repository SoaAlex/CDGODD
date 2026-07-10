import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryFilter } from '@/components/category-filter';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SwipeDeck, type SwipeDeckHandle } from '@/components/swipe-deck';
import { LastVoteBar } from '@/components/last-vote-bar';
import { LEFT_COLOR, RIGHT_COLOR, MaxContentWidth, Spacing } from '@/constants/theme';
import { AdRails } from '@/ads/ad-rails';
import { AdSlot } from '@/ads/ad-slot';
import { useInterstitial } from '@/ads/use-interstitial';
import { useDeck } from '@/hooks/use-deck';
import { useTheme } from '@/hooks/use-theme';
import { fetchTallies, reportItem } from '@/lib/api';
import { t } from '@/lib/i18n';
import { useShowResults } from '@/lib/prefs';
import type { Side, VoteTally } from '@cdgodd/shared';

export default function SoloScreen() {
  // Category filter: empty = all categories. Session-only by design.
  const [categoryKeys, setCategoryKeys] = useState<string[]>([]);
  const [matchAll, setMatchAll] = useState(false);
  const {
    cards,
    loading,
    error,
    lastVote,
    swipe,
    retry,
    restart,
    exhausted,
    allSeen,
  } = useDeck(categoryKeys, matchAll);
  const deck = useRef<SwipeDeckHandle>(null);
  const theme = useTheme();
  const countSwipeForAds = useInterstitial();
  const { showResults, setShowResults } = useShowResults();

  function onSwipe(side: Side) {
    swipe(side);
    countSwipeForAds();
  }
  // Item id whose report was just sent (shows the "merci" state briefly).
  const [reportedId, setReportedId] = useState<number | null>(null);

  const top = cards[0];
  const reported = top !== undefined && reportedId === top.id;

  function report() {
    if (!top || reported) return;
    setReportedId(top.id);
    reportItem(top.id).catch(() => setReportedId(null));
  }

  // Real-time mode: live global tally of the card currently on screen.
  // Seeded instantly from the counts the deck fetch already carries, then
  // refreshed with live numbers in the background.
  const [currentTally, setCurrentTally] = useState<VoteTally | null>(null);
  useEffect(() => {
    if (!showResults || !top) {
      setCurrentTally(null);
      return;
    }
    setCurrentTally({
      itemId: top.id,
      votesLeft: top.votesLeft,
      votesRight: top.votesRight,
    });
    let alive = true;
    fetchTallies([top.id])
      .then(({ tallies }) => {
        if (alive) setCurrentTally(tallies[0] ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [showResults, top]);

  // Web: vote with the keyboard arrows.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') deck.current?.swipeOut('left');
      if (e.key === 'ArrowRight') deck.current?.swipeOut('right');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <ThemedView style={styles.container}>
      <AdRails>
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          {/* Mobile: banner at the top; web gets side rails instead. */}
          {Platform.OS !== 'web' && <AdSlot />}
          <CategoryFilter
            selected={categoryKeys}
            onChange={setCategoryKeys}
            matchAll={matchAll}
            onMatchAllChange={setMatchAll}
            centered
          />
          <View style={styles.deckZone}>
            {loading && <ActivityIndicator size="large" color="#fff" />}

            {!loading && error && (
              <View style={styles.center}>
                <ThemedText>{t('errors.network')}</ThemedText>
                <Pressable onPress={retry} style={styles.retry}>
                  <ThemedText type="linkPrimary">↻</ThemedText>
                </Pressable>
              </View>
            )}

            {!loading && !error && cards.length === 0 && (
              <View style={styles.center}>
                <ThemedText type="subtitle" style={styles.centerText}>
                  {exhausted ? '🎉' : '…'}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.centerText}>
                  {allSeen
                    ? t('solo.allSeen')
                    : exhausted
                      ? t('solo.notFound')
                      : t('errors.network')}
                </ThemedText>
                {allSeen && (
                  <Pressable testID="replay" onPress={restart} style={styles.retry}>
                    <ThemedText type="linkPrimary">
                      ↻ {t('solo.replay')}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            )}

            {cards.length > 0 && (
              // Real-time mode: the live tally renders inside the top card.
              <SwipeDeck
                ref={deck}
                cards={cards}
                onSwipe={onSwipe}
                topTally={showResults ? currentTally : null}
              />
            )}
          </View>

          {cards.length > 0 && (
            <View style={styles.voteRow}>
              <Pressable
                testID="vote-left"
                onPress={() => deck.current?.swipeOut('left')}
                style={({ pressed }) => [
                  styles.voteButton,
                  { backgroundColor: LEFT_COLOR, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Ionicons name="arrow-back" size={22} color="#fff" />
                <ThemedText type="subtitle" style={styles.voteButtonText}>
                  {t('game.left')}
                </ThemedText>
              </Pressable>
              <Pressable
                testID="vote-right"
                onPress={() => deck.current?.swipeOut('right')}
                style={({ pressed }) => [
                  styles.voteButton,
                  { backgroundColor: RIGHT_COLOR, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <ThemedText type="subtitle" style={styles.voteButtonText}>
                  {t('game.right')}
                </ThemedText>
                <Ionicons name="arrow-forward" size={22} color="#fff" />
              </Pressable>
            </View>
          )}

          {top && (
            <View style={styles.actionRow}>
              <Pressable
                testID="report"
                onPress={report}
                disabled={reported}
                style={[styles.smallAction, styles.smallActionRow]}
              >
                <Ionicons
                  name={reported ? 'checkmark' : 'flag-outline'}
                  size={14}
                  color={theme.textSecondary}
                />
                <ThemedText type="small" themeColor="textSecondary">
                  {reported ? t('game.reported') : t('game.report')}
                </ThemedText>
              </Pressable>
              {/* Toggle real-time results — mirrors the settings switch. */}
              <Pressable
                testID="toggle-results"
                onPress={() => setShowResults(!showResults)}
                style={[styles.smallAction, styles.smallActionRow]}
              >
                <Ionicons
                  name={showResults ? 'eye' : 'eye-off'}
                  size={18}
                  color={theme.textSecondary}
                  style={!showResults && styles.dimmed}
                />
                <ThemedText type="small" themeColor="textSecondary">
                  {showResults ? t('game.hideResults') : t('game.showResults')}
                </ThemedText>
              </Pressable>
            </View>
          )}

          {/* The previous card's result is always shown once you've voted. */}
          <View style={styles.footer}>
            {lastVote && <LastVoteBar lastVote={lastVote} />}
          </View>
        </SafeAreaView>
      </AdRails>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  deckZone: {
    flex: 1,
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  centerText: {
    textAlign: 'center',
  },
  retry: {
    padding: Spacing.two,
  },
  voteRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  voteButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  voteButtonText: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 28,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.four,
  },
  smallAction: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  smallActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  dimmed: {
    opacity: 0.5,
  },
  footer: {
    minHeight: 56,
    justifyContent: 'flex-end',
  },
});
