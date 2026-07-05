import { useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LEFT_COLOR, RIGHT_COLOR } from '@/components/swipe-card';
import { SwipeDeck, type SwipeDeckHandle } from '@/components/swipe-deck';
import { TallyBar } from '@/components/tally-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useRoom } from '@/hooks/use-room';
import { t } from '@/lib/i18n';

export default function RoomScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const theme = useTheme();
  const deck = useRef<SwipeDeckHandle>(null);
  const {
    room,
    current,
    liveTally,
    results,
    error,
    connected,
    isHost,
    waiting,
    start,
    vote,
  } = useRoom(code ?? '');

  if (error) {
    return (
      <Centered>
        <ThemedText type="subtitle">😕</ThemedText>
        <ThemedText themeColor="textSecondary">
          {t('errors.roomNotFound')}
        </ThemedText>
      </Centered>
    );
  }

  if (!connected || !room) {
    return (
      <Centered>
        <ActivityIndicator size="large" />
      </Centered>
    );
  }

  // ---- Results ----
  if (room.phase === 'results' && results) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <ThemedText type="subtitle" style={styles.centerText}>
            {t('multiplayer.results')}
          </ThemedText>
          <FlatList
            data={results}
            keyExtractor={(r) => String(r.card.id)}
            contentContainerStyle={styles.resultsList}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.resultRow,
                  { backgroundColor: theme.backgroundElement },
                ]}
              >
                <ThemedText numberOfLines={1} style={styles.resultLabel}>
                  {item.card.label}
                </ThemedText>
                <View style={styles.resultBar}>
                  <TallyBar
                    tally={{
                      itemId: item.card.id,
                      votesLeft: item.votesLeft,
                      votesRight: item.votesRight,
                    }}
                  />
                </View>
              </View>
            )}
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  // ---- Lobby ----
  if (room.phase === 'lobby') {
    return (
      <Centered>
        <ThemedText type="small" themeColor="textSecondary">
          {t('multiplayer.shareCode')}
        </ThemedText>
        <ThemedText type="title" style={styles.code} selectable>
          {room.code}
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          {room.playerCount} {t('multiplayer.players')} ·{' '}
          {room.roundSize} {t('multiplayer.cards')} ·{' '}
          {room.mode === 'live'
            ? t('multiplayer.modeLive')
            : t('multiplayer.modeBatch')}
        </ThemedText>
        {isHost ? (
          <Pressable
            testID="start-round"
            onPress={start}
            style={({ pressed }) => [
              styles.startButton,
              { backgroundColor: RIGHT_COLOR, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <ThemedText type="subtitle" style={{ color: '#fff' }}>
              {t('multiplayer.start')}
            </ThemedText>
          </Pressable>
        ) : (
          <ThemedText themeColor="textSecondary">
            {t('multiplayer.waiting')}
          </ThemedText>
        )}
      </Centered>
    );
  }

  // ---- Playing ----
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          {(current?.index ?? 0) + 1} / {room.roundSize}
        </ThemedText>

        <View style={styles.deckZone}>
          {current && !waiting && (
            <SwipeDeck
              ref={deck}
              cards={[current.card]}
              onSwipe={(side) => vote(side)}
            />
          )}
          {waiting && (
            <View style={styles.centered}>
              <ActivityIndicator />
              <ThemedText themeColor="textSecondary">
                {t('multiplayer.waitingOthers')}
              </ThemedText>
            </View>
          )}
        </View>

        {current && !waiting && (
          <View style={styles.voteRow}>
            <Pressable
              testID="vote-left"
              onPress={() => deck.current?.swipeOut('left')}
              style={({ pressed }) => [
                styles.voteButton,
                { backgroundColor: LEFT_COLOR, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <ThemedText type="subtitle" style={styles.voteText}>
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
              <ThemedText type="subtitle" style={styles.voteText}>
                {t('game.right')} →
              </ThemedText>
            </Pressable>
          </View>
        )}

        <View style={styles.footer}>
          {room.mode === 'live' && liveTally && (
            <TallyBar
              tally={{
                itemId: liveTally.cardIndex,
                votesLeft: liveTally.votesLeft,
                votesRight: liveTally.votesRight,
              }}
            />
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={[styles.safeArea, styles.centered]} edges={['bottom']}>
        {children}
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
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  centerText: {
    textAlign: 'center',
  },
  code: {
    letterSpacing: 8,
  },
  startButton: {
    paddingHorizontal: Spacing.six,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  deckZone: {
    flex: 1,
    justifyContent: 'center',
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
  voteText: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 28,
  },
  footer: {
    minHeight: 40,
    justifyContent: 'flex-end',
  },
  resultsList: {
    gap: Spacing.two,
  },
  resultRow: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  resultLabel: {
    fontWeight: '600',
  },
  resultBar: {},
});
