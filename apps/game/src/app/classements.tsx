import { Link } from 'expo-router';
import Head from 'expo-router/head';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useT, type MessageKey } from '@/lib/i18n';
import {
  mostDivisive,
  mostVoted,
  topMostLeft,
  topMostRight,
  totalVotes,
  type ManifestItem,
} from '@/lib/item-manifest';

const SITE = 'https://cestdegaucheoudedroite.com';
const TOP_N = 20;

interface Section {
  titleKey: MessageKey;
  blurbKey: MessageKey;
  items: ManifestItem[];
  /** Which side's percentage to display for each row. */
  metric: 'auto' | 'votes';
}

export default function RankingsScreen() {
  const { t } = useT();
  const sections: Section[] = [
    {
      titleKey: 'rankings.mostLeftTitle',
      blurbKey: 'rankings.mostLeftBlurb',
      items: topMostLeft(TOP_N),
      metric: 'auto',
    },
    {
      titleKey: 'rankings.mostRightTitle',
      blurbKey: 'rankings.mostRightBlurb',
      items: topMostRight(TOP_N),
      metric: 'auto',
    },
    {
      titleKey: 'rankings.mostDivisiveTitle',
      blurbKey: 'rankings.mostDivisiveBlurb',
      items: mostDivisive(TOP_N),
      metric: 'auto',
    },
    {
      titleKey: 'rankings.mostVotedTitle',
      blurbKey: 'rankings.mostVotedBlurb',
      items: mostVoted(TOP_N),
      metric: 'votes',
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <Head>
        <title>{`${t('rankings.title')} — ${t('menu.title')}`}</title>
        <meta name="description" content={t('seo.rankingsDesc')} />
        <link rel="canonical" href={`${SITE}/classements`} />
      </Head>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('rankings.intro')}
          </ThemedText>

          {sections.map((section) => (
            <View key={section.titleKey} style={styles.section}>
              <ThemedText type="subtitle">{t(section.titleKey)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t(section.blurbKey)}
              </ThemedText>
              {section.items.map((item, index) => {
                const total = totalVotes(item);
                const leftPct =
                  total > 0 ? Math.round((item.votesLeft / total) * 100) : 0;
                const metric =
                  section.metric === 'votes'
                    ? `${total} ${total === 1 ? t('item.voteSingular') : t('item.votePlural')}`
                    : leftPct >= 50
                      ? `${leftPct} % ${t('game.left').toLowerCase()}`
                      : `${100 - leftPct} % ${t('game.right').toLowerCase()}`;
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
                    <ThemedText type="small" themeColor="textSecondary">
                      {metric}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          ))}

          <View style={styles.linksRow}>
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
    gap: Spacing.five,
  },
  section: {
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
  },
  inlineLink: {
    textDecorationLine: 'underline',
    opacity: 0.9,
  },
});
