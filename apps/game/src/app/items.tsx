import { Link } from 'expo-router';
import Head from 'expo-router/head';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { getItems } from '@/lib/item-manifest';

/**
 * Crawlable index of every approved item, linking to its /item/<seg> page.
 * Rendered with a plain .map() — NOT a FlatList — so all anchors land in the
 * prerendered HTML (virtualization would drop off-screen rows from the SSG
 * output). With an empty manifest (local dev without the generate script)
 * the page just shows the intro text.
 */
export default function ItemsScreen() {
  const { t } = useT();
  const items = getItems();
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
          <View style={styles.list}>
            {items.map((item) => {
              const total = item.votesLeft + item.votesRight;
              const leftPct =
                total > 0
                  ? Math.round((item.votesLeft / total) * 100)
                  : null;
              return (
                // asChild + static style: see MenuButton in index.tsx.
                <Link key={item.id} href={`/item/${item.seg}` as never} asChild>
                  <Pressable style={styles.row}>
                    <ThemedText type="small" style={styles.rowLabel}>
                      {item.label}
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
            })}
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
});
