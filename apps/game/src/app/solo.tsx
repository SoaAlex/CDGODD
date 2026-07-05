import { useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LEFT_COLOR, RIGHT_COLOR } from '@/components/swipe-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SwipeDeck, type SwipeDeckHandle } from '@/components/swipe-deck';
import { TallyBar } from '@/components/tally-bar';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useDeck } from '@/hooks/use-deck';
import { t } from '@/lib/i18n';

export default function SoloScreen() {
  const { cards, loading, error, lastTally, swipe, retry, exhausted } =
    useDeck();
  const deck = useRef<SwipeDeckHandle>(null);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.deckZone}>
          {loading && <ActivityIndicator size="large" />}

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
                {exhausted ? t('solo.notFound') : t('errors.network')}
              </ThemedText>
            </View>
          )}

          {cards.length > 0 && (
            <SwipeDeck ref={deck} cards={cards} onSwipe={swipe} />
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
              <ThemedText type="subtitle" style={styles.voteButtonText}>
                ← {t('game.left')}
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
                {t('game.right')} →
              </ThemedText>
            </Pressable>
          </View>
        )}

        <View style={styles.footer}>
          {lastTally && <TallyBar tally={lastTally} />}
        </View>
      </SafeAreaView>
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
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  voteButtonText: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 28,
  },
  footer: {
    minHeight: 48,
    justifyContent: 'flex-end',
  },
});
