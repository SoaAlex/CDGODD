import { Ionicons } from '@expo/vector-icons';
import { Link, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Side, VoteTally } from '@cdgodd/shared';
import { SwipeCard } from '@/components/swipe-card';
import { TallyBar } from '@/components/tally-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LEFT_COLOR, MaxContentWidth, RIGHT_COLOR, Spacing } from '@/constants/theme';
import { useCategoryName } from '@/hooks/use-categories';
import { castVote, fetchTallies } from '@/lib/api';
import { recordVote } from '@/lib/history';
import { useT } from '@/lib/i18n';
import {
  findItem,
  getItems,
  toDeckCard,
  type ManifestItem,
} from '@/lib/item-manifest';

const SITE = 'https://cestdegaucheoudedroite.com';
const RELATED_COUNT = 8;

/** One prerendered HTML page per approved item (see scripts/
 * generate-item-manifest.mjs). Ids missing from the manifest still resolve
 * at runtime through the SPA fallback and render the not-found state. */
export function generateStaticParams(): Array<{ id: string }> {
  return getItems().map((i) => ({ id: i.seg }));
}

/** Deterministic "more items" links: the next N catalog entries after the
 * current one (wrapping around), so every page links deeper into the site. */
function relatedItems(item: ManifestItem): ManifestItem[] {
  const items = getItems();
  const at = items.findIndex((i) => i.id === item.id);
  const out: ManifestItem[] = [];
  for (let step = 1; step <= RELATED_COUNT && step < items.length; step += 1) {
    const next = items[(at + step) % items.length];
    if (next) out.push(next);
  }
  return out;
}

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useT();
  const categoryName = useCategoryName();
  const item = findItem(String(id ?? ''));
  const [tally, setTally] = useState<VoteTally | null>(null);
  const [voted, setVoted] = useState(false);

  // The manifest counts are a build-time snapshot; swap in live numbers once
  // hydrated.
  const itemId = item?.id;
  useEffect(() => {
    if (itemId === undefined) return;
    fetchTallies([itemId])
      .then(({ tallies }) => {
        const fresh = tallies[0];
        if (fresh) setTally(fresh);
      })
      .catch(() => {});
  }, [itemId]);

  if (!item) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <View style={styles.notFound}>
            <ThemedText themeColor="textSecondary">
              {t('item.notFound')}
            </ThemedText>
            <Link href={'/items' as never}>
              <ThemedText type="small" style={styles.inlineLink}>
                {t('item.browseAll')}
              </ThemedText>
            </Link>
            <Link href={'/solo' as never}>
              <ThemedText type="small" style={styles.inlineLink}>
                {t('item.playCta')}
              </ThemedText>
            </Link>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const votesLeft = tally?.votesLeft ?? item.votesLeft;
  const votesRight = tally?.votesRight ?? item.votesRight;
  const total = votesLeft + votesRight;
  const leftPct = total > 0 ? Math.round((votesLeft / total) * 100) : 0;
  const verdict =
    total === 0
      ? t('game.noVotesYet')
      : leftPct >= 50
        ? `${leftPct} % ${t('item.percentLeft')}`
        : `${100 - leftPct} % ${t('item.percentRight')}`;

  function vote(side: Side) {
    if (!item) return;
    void recordVote({
      itemId: item.id,
      side,
      label: item.label,
      imageUrl: item.imageUrl,
      at: Date.now(),
    });
    setVoted(true);
    castVote(item.id, side)
      .then(({ tally: fresh }) => setTally(fresh))
      .catch(() => {});
  }

  return (
    <ThemedView style={styles.container}>
      <Head>
        <title>{`${item.label} — ${t('menu.title')}`}</title>
        <meta
          name="description"
          content={
            total > 0
              ? `${item.label} : ${verdict}. ${t('seo.itemDescSuffix')}`
              : `${item.label} : ${t('seo.itemDescSuffix')}`
          }
        />
        <link rel="canonical" href={`${SITE}/item/${item.seg}`} />
      </Head>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="title" style={styles.title}>
            {item.label}
          </ThemedText>
          {item.categoryKeys.length > 0 && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.categories}>
              {t('filter.categoriesLabel')} :{' '}
              {item.categoryKeys.map(categoryName).join(' · ')}
            </ThemedText>
          )}

          <View style={styles.cardSlot}>
            <SwipeCard card={toDeckCard(item)} />
          </View>

          <ThemedText style={styles.verdict}>{verdict}</ThemedText>

          {voted && tally ? (
            <TallyBar tally={tally} />
          ) : (
            <>
              <ThemedText type="small" themeColor="textSecondary" style={styles.voteCta}>
                {t('item.voteCta')}
              </ThemedText>
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
            </>
          )}

          <View style={styles.linksRow}>
            <Link href={'/solo' as never}>
              <ThemedText type="small" style={styles.inlineLink}>
                {t('item.playCta')}
              </ThemedText>
            </Link>
            <Link href={'/items' as never}>
              <ThemedText type="small" style={styles.inlineLink}>
                {t('item.browseAll')}
              </ThemedText>
            </Link>
          </View>

          {relatedItems(item).length > 0 && (
            <View style={styles.related}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                {t('item.moreItems')}
              </ThemedText>
              {relatedItems(item).map((rel) => (
                <Link key={rel.id} href={`/item/${rel.seg}` as never}>
                  <ThemedText type="small" style={styles.inlineLink}>
                    {rel.label}
                  </ThemedText>
                </Link>
              ))}
            </View>
          )}
        </ScrollView>
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
  },
  scroll: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    textAlign: 'center',
  },
  categories: {
    textAlign: 'center',
  },
  cardSlot: {
    height: 420,
  },
  verdict: {
    textAlign: 'center',
    fontWeight: '600',
  },
  voteCta: {
    textAlign: 'center',
  },
  voteRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.six,
  },
  voteText: {
    color: '#fff',
  },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: Spacing.four,
    paddingTop: Spacing.three,
  },
  related: {
    gap: Spacing.two,
    paddingTop: Spacing.four,
  },
  notFound: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  inlineLink: {
    textDecorationLine: 'underline',
    opacity: 0.9,
  },
});
