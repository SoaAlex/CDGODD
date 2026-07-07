import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
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
  const deckRef = useRef<SwipeDeckHandle>(null);
  const {
    room,
    deck,
    myIndex,
    liveTally,
    results,
    error,
    connected,
    isHost,
    done,
    start,
    vote,
  } = useRoom(code ?? '');

  // Web: vote with the keyboard arrows.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') deckRef.current?.swipeOut('left');
      if (e.key === 'ArrowRight') deckRef.current?.swipeOut('right');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
        <ActivityIndicator size="large" color="#fff" />
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
            <View style={styles.buttonContent}>
              <Ionicons name="play" size={22} color="#fff" />
              <ThemedText type="subtitle" style={{ color: '#fff' }}>
                {t('multiplayer.start')}
              </ThemedText>
            </View>
          </Pressable>
        ) : (
          <ThemedText themeColor="textSecondary">
            {t('multiplayer.waiting')}
          </ThemedText>
        )}
      </Centered>
    );
  }

  // ---- Playing (each player swipes the whole deck at their own pace) ----
  const remaining = deck ? deck.slice(myIndex) : [];
  // Live mode: show the tally only for the card we just voted on.
  const showLiveTally =
    room.mode === 'live' && liveTally?.cardIndex === myIndex - 1;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          {Math.min(myIndex + 1, room.roundSize)} / {room.roundSize}
        </ThemedText>

        <View style={styles.deckZone}>
          {!done && remaining.length > 0 && (
            <SwipeDeck
              ref={deckRef}
              cards={remaining}
              onSwipe={(side) => vote(side)}
            />
          )}
          {done && (
            <View style={styles.centered}>
              <ActivityIndicator color="#fff" />
              <ThemedText themeColor="textSecondary">
                {t('multiplayer.waitingOthers')}
              </ThemedText>
            </View>
          )}
        </View>

        {!done && remaining.length > 0 && (
          <View style={styles.voteRow}>
            <Pressable
              testID="vote-left"
              onPress={() => deckRef.current?.swipeOut('left')}
              style={({ pressed }) => [
                styles.voteButton,
                { backgroundColor: LEFT_COLOR, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name="arrow-back" size={22} color="#fff" />
              <ThemedText type="subtitle" style={styles.voteText}>
                {t('game.left')}
              </ThemedText>
            </Pressable>
            <Pressable
              testID="vote-right"
              onPress={() => deckRef.current?.swipeOut('right')}
              style={({ pressed }) => [
                styles.voteButton,
                { backgroundColor: RIGHT_COLOR, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <ThemedText type="subtitle" style={styles.voteText}>
                {t('game.right')}
              </ThemedText>
              <Ionicons name="arrow-forward" size={22} color="#fff" />
            </Pressable>
          </View>
        )}

        <View style={styles.footer}>
          {showLiveTally && liveTally && (
            <View style={styles.tallyBlock}>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={styles.centerText}
              >
                {t('game.globalVotes')}
              </ThemedText>
              <TallyBar
                tally={{
                  itemId: liveTally.cardIndex,
                  votesLeft: liveTally.votesLeft,
                  votesRight: liveTally.votesRight,
                }}
              />
            </View>
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
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
  tallyBlock: {
    gap: Spacing.one,
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
