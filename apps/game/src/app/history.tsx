import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { VoteTally } from '@cdgodd/shared';
import { TallyBar } from '@/components/tally-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LEFT_COLOR, RIGHT_COLOR, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchTallies } from '@/lib/api';
import { getHistory, type HistoryEntry } from '@/lib/history';
import { t } from '@/lib/i18n';

/**
 * The player's own vote history (device-local) enriched with the current
 * global tallies fetched from the API.
 */
export default function HistoryScreen() {
  const theme = useTheme();
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [tallies, setTallies] = useState<Map<number, VoteTally>>(new Map());

  useEffect(() => {
    void (async () => {
      const history = await getHistory();
      setEntries(history);
      if (history.length === 0) return;
      try {
        const { tallies } = await fetchTallies(history.map((h) => h.itemId));
        setTallies(new Map(tallies.map((t) => [t.itemId, t])));
      } catch {
        /* history still shows without global numbers */
      }
    })();
  }, []);

  if (entries === null) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#fff" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <FlatList
          data={entries}
          keyExtractor={(e) => String(e.itemId)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <ThemedText type="subtitle">🗳️</ThemedText>
              <ThemedText themeColor="textSecondary">
                {t('history.empty')}
              </ThemedText>
            </View>
          }
          renderItem={({ item }) => {
            const tally = tallies.get(item.itemId);
            const sideColor = item.side === 'left' ? LEFT_COLOR : RIGHT_COLOR;
            return (
              <View
                style={[styles.row, { backgroundColor: theme.surface }]}
              >
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.thumb}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.thumb, styles.thumbFallback]}>
                    <ThemedText type="small">🤔</ThemedText>
                  </View>
                )}
                <View style={styles.body}>
                  <View style={styles.titleRow}>
                    <ThemedText
                      type="smallBold"
                      themeColor="textOnSurface"
                      numberOfLines={1}
                      style={styles.label}
                    >
                      {item.label}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondaryOnSurface">
                      {t('history.yourVote')}
                    </ThemedText>
                    <View style={[styles.voteChip, { backgroundColor: sideColor }]}>
                      <ThemedText type="small" style={styles.voteChipText}>
                        {item.side === 'left' ? t('game.left') : t('game.right')}
                      </ThemedText>
                    </View>
                  </View>
                  {tally && (
                    <View style={styles.tallyBlock}>
                      <ThemedText type="small" themeColor="textSecondaryOnSurface">
                        {t('game.globalVotes')}
                      </ThemedText>
                      <TallyBar tally={tally} />
                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />
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
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing.four,
  },
  list: {
    gap: Spacing.three,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.six,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: Spacing.one,
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef0f6',
  },
  body: {
    flex: 1,
    gap: Spacing.one,
  },
  tallyBlock: {
    gap: Spacing.one,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  label: {
    flex: 1,
  },
  voteChip: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
  },
  voteChipText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 18,
  },
});
