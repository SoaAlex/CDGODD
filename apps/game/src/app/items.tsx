import { Link } from 'expo-router';
import Head from 'expo-router/head';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import {
  getCategories,
  getItems,
  isAmbiguousLabel,
  manifestCategoryName,
  totalVotes,
  type ManifestItem,
} from '@/lib/item-manifest';

/**
 * Crawlable index of every approved item, grouped by category, linking to
 * each /item/<seg> page and each /categorie/<key> page. Rendered with plain
 * .map() — NOT a FlatList — so all anchors land in the prerendered HTML
 * (virtualization would drop off-screen rows from the SSG output). With an
 * empty manifest (local dev without the generate script) the page just
 * shows the intro text.
 */
export default function ItemsScreen() {
  const { t } = useT();
  const categories = getCategories();
  const items = getItems();

  // Items can carry several categories; list each under its first category
  // only so the page has no duplicate links. Items with no category (or an
  // unknown one) land in a trailing group.
  const grouped = new Map<string, ManifestItem[]>();
  for (const category of categories) grouped.set(category.key, []);
  const uncategorized: ManifestItem[] = [];
  for (const item of items) {
    const first = item.categoryKeys[0];
    const bucket = first !== undefined ? grouped.get(first) : undefined;
    if (bucket) bucket.push(item);
    else uncategorized.push(item);
  }

  const renderRow = (item: ManifestItem) => {
    const total = totalVotes(item);
    const leftPct =
      total > 0 ? Math.round((item.votesLeft / total) * 100) : null;
    const first = item.categoryKeys[0];
    const suffix =
      isAmbiguousLabel(item) && first !== undefined
        ? ` (${manifestCategoryName(first) ?? first})`
        : '';
    return (
      // asChild + single static style: see MenuButton in index.tsx.
      <Link key={item.id} href={`/item/${item.seg}` as never} asChild>
        <Pressable style={styles.row}>
          <ThemedText type="small" style={styles.rowLabel}>
            {`${item.label}${suffix}`}
          </ThemedText>
          {leftPct !== null && (
            <ThemedText type="small" themeColor="textSecondary">
              {leftPct >= 50
                ? `${leftPct} % ${t('game.left').toLowerCase()}`
                : `${100 - leftPct} % ${t('game.right').toLowerCase()}`}
            </ThemedText>
          )}
        </Pressable>
      </Link>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <Head>
        <title>{t('menu.browse')}</title>
        <meta name="description" content={t('seo.itemsDesc')} />
      </Head>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('seo.itemsDesc')}
          </ThemedText>
          <View style={styles.linksRow}>
            <Link href={'/classements' as never}>
              <ThemedText type="small" style={styles.inlineLink}>
                {t('menu.rankings')}
              </ThemedText>
            </Link>
            <Link href={'/a-propos' as never}>
              <ThemedText type="small" style={styles.inlineLink}>
                {t('menu.about')}
              </ThemedText>
            </Link>
          </View>

          {categories.map((category) => {
            const bucket = grouped.get(category.key) ?? [];
            if (bucket.length === 0) return null;
            return (
              <View key={category.key} style={styles.group}>
                <Link href={`/categorie/${category.key}` as never}>
                  <ThemedText type="subtitle" style={styles.groupTitle}>
                    {category.name}
                  </ThemedText>
                </Link>
                <View style={styles.list}>{bucket.map(renderRow)}</View>
              </View>
            );
          })}
          {uncategorized.length > 0 && (
            <View style={styles.group}>
              <View style={styles.list}>{uncategorized.map(renderRow)}</View>
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
    gap: Spacing.four,
  },
  linksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.four,
  },
  group: {
    gap: Spacing.two,
  },
  groupTitle: {
    textDecorationLine: 'underline',
  },
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowLabel: {
    textDecorationLine: 'underline',
  },
  inlineLink: {
    textDecorationLine: 'underline',
    opacity: 0.9,
  },
});
