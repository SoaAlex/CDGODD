import { Ionicons } from '@expo/vector-icons';
import Head from 'expo-router/head';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DeckCard, Side, VoteTally } from '@cdgodd/shared';
import { SwipeCard } from '@/components/swipe-card';
import { TallyBar } from '@/components/tally-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LEFT_COLOR, RIGHT_COLOR, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCategoryName } from '@/hooks/use-categories';
import { castVote, searchItems, submitItem } from '@/lib/api';
import { recordVote } from '@/lib/history';
import { useT } from '@/lib/i18n';

const DEBOUNCE_MS = 300;

/**
 * Free-search mode: find an item and vote on it; if it doesn't exist,
 * propose it for admin validation.
 */
export default function SearchScreen() {
  const { t, lang } = useT();
  const categoryName = useCategoryName();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DeckCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<DeckCard | null>(null);
  const [tally, setTally] = useState<VoteTally | null>(null);
  const [submitted, setSubmitted] = useState<false | 'sent' | 'duplicate'>(
    false,
  );
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    setSubmitted(false);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounce.current = setTimeout(() => {
      searchItems(q, lang)
        .then(({ results }) => setResults(results))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, DEBOUNCE_MS);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, lang]);

  function pick(card: DeckCard) {
    setSelected(card);
    setTally(null);
  }

  function vote(side: Side) {
    if (!selected) return;
    void recordVote({
      itemId: selected.id,
      side,
      label: selected.label,
      imageUrl: selected.imageUrl,
      at: Date.now(),
    });
    castVote(selected.id, side)
      .then(({ tally }) => setTally(tally))
      .catch(() => setTally(null));
  }

  function propose() {
    submitItem(query.trim())
      .then((r) =>
        setSubmitted(r.status === 'duplicate' ? 'duplicate' : 'sent'),
      )
      .catch(() => setSubmitted(false));
  }

  const q = query.trim();
  const showNotFound =
    q.length >= 2 && !searching && results.length === 0 && !submitted;

  return (
    <ThemedView style={styles.container}>
      <Head>
        <title>{t('solo.search')}</title>
        <meta name="description" content={t('seo.searchDesc')} />
      </Head>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <TextInput
          testID="search-input"
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setSelected(null);
            setTally(null);
          }}
          placeholder={t('solo.searchPlaceholder')}
          placeholderTextColor={theme.textSecondaryOnSurface}
          autoFocus
          style={[
            styles.input,
            { backgroundColor: theme.surface, color: theme.textOnSurface },
          ]}
        />

        {searching && <ActivityIndicator style={styles.spinner} color="#fff" />}

        {!selected && (
          <FlatList
            data={results}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <Pressable
                testID={`result-${item.id}`}
                onPress={() => pick(item)}
                style={({ pressed }) => [
                  styles.resultRow,
                  {
                    backgroundColor: pressed
                      ? theme.surfacePressed
                      : theme.surface,
                  },
                ]}
              >
                <ThemedText themeColor="textOnSurface">{item.label}</ThemedText>
                {item.categoryKeys.length > 0 && (
                  <ThemedText type="small" themeColor="textSecondaryOnSurface">
                    {item.categoryKeys.map(categoryName).join(' · ')}
                  </ThemedText>
                )}
              </Pressable>
            )}
            ListEmptyComponent={
              showNotFound ? (
                <View style={styles.notFound}>
                  <ThemedText themeColor="textSecondary">
                    {t('solo.notFound')}
                  </ThemedText>
                  <Pressable
                    testID="propose"
                    onPress={propose}
                    style={({ pressed }) => [
                      styles.proposeButton,
                      { backgroundColor: RIGHT_COLOR, opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <View style={styles.proposeContent}>
                      <Ionicons name="add-circle-outline" size={18} color="#fff" />
                      <ThemedText style={styles.proposeText}>
                        {t('solo.submit')} « {q} »
                      </ThemedText>
                    </View>
                  </Pressable>
                </View>
              ) : submitted ? (
                <View style={styles.notFound}>
                  <ThemedText testID="submitted">
                    {submitted === 'duplicate'
                      ? `👀 ${t('solo.duplicate')}`
                      : `✅ ${t('solo.submitted')}`}
                  </ThemedText>
                </View>
              ) : null
            }
            contentContainerStyle={styles.list}
          />
        )}

        {selected && (
          <View style={styles.voteZone}>
            <View style={styles.cardSlot}>
              <SwipeCard card={selected} />
            </View>
            {tally ? (
              <TallyBar tally={tally} />
            ) : (
              <View style={styles.voteRow}>
                <Pressable
                  testID="vote-left"
                  onPress={() => vote('left')}
                  style={({ pressed }) => [
                    styles.voteButton,
                    { backgroundColor: LEFT_COLOR, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Ionicons name="arrow-back" size={20} color="#fff" />
                  <ThemedText type="subtitle" style={styles.voteText}>
                    {t('game.left')}
                  </ThemedText>
                </Pressable>
                <Pressable
                  testID="vote-right"
                  onPress={() => vote('right')}
                  style={({ pressed }) => [
                    styles.voteButton,
                    { backgroundColor: RIGHT_COLOR, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <ThemedText type="subtitle" style={styles.voteText}>
                    {t('game.right')}
                  </ThemedText>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </Pressable>
              </View>
            )}
          </View>
        )}
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
  input: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 18,
  },
  spinner: {
    marginTop: Spacing.two,
  },
  list: {
    gap: Spacing.two,
  },
  resultRow: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notFound: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.four,
  },
  proposeButton: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  proposeText: {
    color: '#fff',
  },
  voteZone: {
    flex: 1,
    gap: Spacing.three,
  },
  cardSlot: {
    flex: 1,
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
  proposeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  voteText: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 28,
  },
});
