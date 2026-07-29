import { Link, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useCategoryName } from '@/hooks/use-categories';
import { useT } from '@/lib/i18n';
import {
  categoryItemsRanked,
  getCategories,
  manifestCategoryName,
  totalVotes,
} from '@/lib/item-manifest';

const SITE = 'https://cestdegaucheoudedroite.com';

/** One prerendered page per category: its items ranked most-left ->
 * most-right. Categories come from the build-time manifest (nsfw already
 * excluded there). */
export function generateStaticParams(): Array<{ key: string }> {
  return getCategories()
    .filter((c) => categoryItemsRanked(c.key).length > 0)
    .map((c) => ({ key: c.key }));
}

export default function CategoryScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { t } = useT();
  const runtimeCategoryName = useCategoryName();
  const categoryKey = String(key ?? '');
  // Manifest first: at prerender the runtime hook only knows the raw key.
  const name =
    manifestCategoryName(categoryKey) ?? runtimeCategoryName(categoryKey);
  const ranked = categoryItemsRanked(categoryKey);

  if (ranked.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <View style={styles.empty}>
            <ThemedText themeColor="textSecondary">
              {t('item.notFound')}
            </ThemedText>
            <Link href={'/items' as never}>
              <ThemedText type="small" style={styles.inlineLink}>
                {t('item.browseAll')}
              </ThemedText>
            </Link>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Head>
        <title>{`${name} — ${t('menu.title')}`}</title>
        <meta
          name="description"
          content={`${t('seo.categoryDescPrefix')} ${name}, ${t('seo.categoryDescSuffix')}`}
        />
        <link rel="canonical" href={`${SITE}/categorie/${categoryKey}`} />
      </Head>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="title" style={styles.title}>
            {name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {ranked.length} {t('category.itemsWord')} — {t('category.intro')}
          </ThemedText>

          <View style={styles.list}>
            {ranked.map((item, index) => {
              const total = totalVotes(item);
              const leftPct =
                total > 0 ? Math.round((item.votesLeft / total) * 100) : null;
              return (
                <View key={item.id} style={styles.row}>
                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                    style={styles.rowRank}
                  >
                    {index + 1}.
                  </ThemedText>
                  <Link href={`/item/${item.seg}` as never} style={styles.rowLink}>
                    <ThemedText type="small" style={styles.inlineLink}>
                      {item.label}
                    </ThemedText>
                  </Link>
                  {leftPct !== null && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {leftPct >= 50
                        ? `${leftPct} % ${t('game.left').toLowerCase()}`
                        : `${100 - leftPct} % ${t('game.right').toLowerCase()}`}
                    </ThemedText>
                  )}
                </View>
              );
            })}
          </View>

          <View style={styles.linksRow}>
            <Link href={'/items' as never}>
              <ThemedText type="small" style={styles.inlineLink}>
                {t('category.backToAll')}
              </ThemedText>
            </Link>
            <Link href={'/classements' as never}>
              <ThemedText type="small" style={styles.inlineLink}>
                {t('item.seeRankings')}
              </ThemedText>
            </Link>
            <Link href={'/solo' as never}>
              <ThemedText type="small" style={styles.inlineLink}>
                {t('item.playCta')}
              </ThemedText>
            </Link>
          </View>
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
    gap: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowRank: {
    minWidth: 28,
    textAlign: 'right',
  },
  rowLink: {
    flexShrink: 1,
  },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: Spacing.four,
    paddingTop: Spacing.two,
  },
  empty: {
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
