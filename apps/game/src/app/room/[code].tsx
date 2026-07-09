import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RoomMode, Side } from '@cdgodd/shared';
import { AdRails } from '@/ads/ad-rails';
import { AdSlot } from '@/ads/ad-slot';
import { MIN_ROUND_SIZE, RoomSettings } from '@/components/room-settings';
import { LEFT_COLOR, RIGHT_COLOR } from '@/components/swipe-card';
import { SwipeDeck, type SwipeDeckHandle } from '@/components/swipe-deck';
import { TallyBar } from '@/components/tally-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useRoom } from '@/hooks/use-room';
import { categoryName, t } from '@/lib/i18n';

export default function RoomScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const theme = useTheme();
  const deckRef = useRef<SwipeDeckHandle>(null);
  // Nickname lives only in this screen's state: gone when the room closes.
  const [nameInput, setNameInput] = useState('');
  const [name, setName] = useState<string | null>(null);
  // Host replay: "Rejouer" first opens this settings step (same form as
  // room creation), then restarts the round with the chosen settings.
  const [configuring, setConfiguring] = useState(false);
  const [replayMode, setReplayMode] = useState<RoomMode>('batch');
  const [replayRoundSize, setReplayRoundSize] = useState(10);
  const [replayCategoryKeys, setReplayCategoryKeys] = useState<string[]>([]);
  const {
    room,
    deck,
    myIndex,
    liveTally,
    results,
    myVotes,
    error,
    connected,
    isHost,
    done,
    start,
    restart,
    vote,
  } = useRoom(code ?? '', name);

  // Leaving the results phase (round restarted) closes the settings step.
  const phase = room?.phase;
  useEffect(() => {
    if (phase !== 'results') setConfiguring(false);
  }, [phase]);

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

  // ---- Nickname (asked before connecting, so everyone joins named) ----
  if (!name) {
    const clean = nameInput.trim();
    return (
      <Centered>
        <ThemedText type="subtitle">{t('multiplayer.nickname')}</ThemedText>
        <TextInput
          testID="nickname-input"
          value={nameInput}
          onChangeText={setNameInput}
          placeholder={t('multiplayer.nicknamePlaceholder')}
          placeholderTextColor={theme.textSecondary}
          autoCorrect={false}
          maxLength={24}
          onSubmitEditing={() => clean && setName(clean)}
          style={[
            styles.nameInput,
            { backgroundColor: theme.backgroundElement, color: theme.text },
          ]}
        />
        <Pressable
          testID="nickname-submit"
          onPress={() => setName(clean)}
          disabled={!clean}
          style={({ pressed }) => [
            styles.startButton,
            {
              backgroundColor: RIGHT_COLOR,
              opacity: !clean ? 0.4 : pressed ? 0.8 : 1,
            },
          ]}
        >
          <View style={styles.buttonContent}>
            <Ionicons name="enter-outline" size={22} color="#fff" />
            <ThemedText type="subtitle" style={{ color: '#fff' }}>
              {t('multiplayer.join')}
            </ThemedText>
          </View>
        </Pressable>
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

  // ---- Replay settings (host, from results): same form as room creation ----
  if (room.phase === 'results' && isHost && configuring) {
    return (
      <Centered>
        <ThemedText type="subtitle">{t('multiplayer.playAgain')}</ThemedText>
        <RoomSettings
          mode={replayMode}
          roundSize={replayRoundSize}
          categoryKeys={replayCategoryKeys}
          onModeChange={setReplayMode}
          onRoundSizeChange={setReplayRoundSize}
          onCategoryKeysChange={setReplayCategoryKeys}
        />
        <Pressable
          testID="restart-round"
          onPress={() =>
            restart({
              mode: replayMode,
              roundSize: replayRoundSize,
              categoryKeys: replayCategoryKeys,
            })
          }
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
            renderItem={({ item, index }) => {
              const myVote: Side | undefined = myVotes[index];
              return (
                <View
                  style={[
                    styles.resultRow,
                    { backgroundColor: theme.backgroundElement },
                  ]}
                >
                  <ThemedText type="subtitle" numberOfLines={2}>
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
                  {myVote && (
                    <View style={styles.myVoteRow}>
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('history.yourVote')}
                      </ThemedText>
                      <View
                        style={[
                          styles.sideBadge,
                          {
                            backgroundColor:
                              myVote === 'left' ? LEFT_COLOR : RIGHT_COLOR,
                          },
                        ]}
                      >
                        <ThemedText type="small" style={styles.sideBadgeText}>
                          {myVote === 'left' ? t('game.left') : t('game.right')}
                        </ThemedText>
                      </View>
                    </View>
                  )}
                  <View style={styles.votersRow}>
                    <View style={styles.votersSide}>
                      {item.votersLeft.map((voter, i) => (
                        <View
                          key={`${voter}-${i}`}
                          style={[
                            styles.voterChip,
                            { backgroundColor: LEFT_COLOR },
                          ]}
                        >
                          <ThemedText type="small" style={styles.voterChipText}>
                            {voter}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                    <View style={[styles.votersSide, styles.votersSideRight]}>
                      {item.votersRight.map((voter, i) => (
                        <View
                          key={`${voter}-${i}`}
                          style={[
                            styles.voterChip,
                            { backgroundColor: RIGHT_COLOR },
                          ]}
                        >
                          <ThemedText type="small" style={styles.voterChipText}>
                            {voter}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              );
            }}
          />
          {/* Room stays open: host can relaunch with the same players. */}
          {isHost ? (
            <Pressable
              testID="replay-settings"
              onPress={() => {
                setReplayMode(room.mode);
                // roundSize can be below the minimum when the filter had
                // fewer items than requested; snap back into the valid range.
                setReplayRoundSize(Math.max(MIN_ROUND_SIZE, room.roundSize));
                setReplayCategoryKeys(room.categoryKeys);
                setConfiguring(true);
              }}
              style={({ pressed }) => [
                styles.startButton,
                styles.selfCenter,
                { backgroundColor: RIGHT_COLOR, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={styles.buttonContent}>
                <Ionicons name="refresh" size={22} color="#fff" />
                <ThemedText type="subtitle" style={{ color: '#fff' }}>
                  {t('multiplayer.playAgain')}
                </ThemedText>
              </View>
            </Pressable>
          ) : (
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              {t('multiplayer.waitingHost')}
            </ThemedText>
          )}
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
        {room.categoryKeys.length > 0 && (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.centerText}
          >
            {t('filter.categoriesLabel')} :{' '}
            {room.categoryKeys.map(categoryName).join(' · ')}
          </ThemedText>
        )}
        <View style={styles.playerList}>
          {room.players.map((p) => (
            <View
              key={p.id}
              style={[
                styles.playerChip,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              <Ionicons
                name={p.id === room.hostId ? 'star' : 'person'}
                size={14}
                color={theme.textSecondary}
              />
              <ThemedText type="small">{p.name}</ThemedText>
            </View>
          ))}
        </View>
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
      <AdRails>
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          {/* Mobile: banner at the top; web gets side rails instead. */}
          {Platform.OS !== 'web' && <AdSlot />}
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
      </AdRails>
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
  selfCenter: {
    alignSelf: 'center',
  },
  nameInput: {
    width: '100%',
    maxWidth: 320,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 22,
    textAlign: 'center',
  },
  playerList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
    maxWidth: '90%',
  },
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.four,
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
    gap: Spacing.three,
  },
  resultRow: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  resultBar: {},
  myVoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sideBadge: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
  },
  sideBadgeText: {
    color: '#fff',
    fontSize: 12,
    lineHeight: 16,
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
  voterChip: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
  },
  voterChipText: {
    color: '#fff',
    fontSize: 12,
    lineHeight: 16,
  },
});
