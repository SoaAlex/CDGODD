import { Link } from 'expo-router';
import Head from 'expo-router/head';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinkRow } from '@/components/link-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useT, type MessageKey } from '@/lib/i18n';

const SITE = 'https://cestdegaucheoudedroite.com';
const SUPPORT_EMAIL = 'support@cestdegaucheoudedroite.com';

const FAQ: Array<{ q: MessageKey; a: MessageKey }> = [
  { q: 'about.faqQ1', a: 'about.faqA1' },
  { q: 'about.faqQ2', a: 'about.faqA2' },
  { q: 'about.faqQ3', a: 'about.faqA3' },
  { q: 'about.faqQ4', a: 'about.faqA4' },
  { q: 'about.faqQ5', a: 'about.faqA5' },
];

/** Editorial about page: concept, methodology, moderation, FAQ. The main
 * "real content" surface for readers (and reviewers) who want to understand
 * how the game works without playing it. */
export default function AboutScreen() {
  const { t } = useT();
  return (
    <ThemedView style={styles.container}>
      <Head>
        <title>{`${t('about.title')} — ${t('menu.title')}`}</title>
        <meta name="description" content={t('seo.aboutDesc')} />
        <link rel="canonical" href={`${SITE}/a-propos`} />
      </Head>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Concept */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('about.whatTitle')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('about.whatBody')}
            </ThemedText>
          </View>

          {/* Methodology */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('about.methodTitle')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('about.methodBody')}
            </ThemedText>
          </View>

          {/* Moderation & submissions */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('about.moderationTitle')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('about.moderationBody')}
            </ThemedText>
          </View>

          {/* FAQ */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('about.faqTitle')}
            </ThemedText>
            {FAQ.map(({ q, a }) => (
              <View key={q} style={styles.faqEntry}>
                <ThemedText type="small" style={styles.faqQuestion}>
                  {t(q)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t(a)}
                </ThemedText>
              </View>
            ))}
          </View>

          {/* Internal links: play + explore content pages. */}
          <View style={styles.linksRow}>
            <Link href={'/solo' as never}>
              <ThemedText type="small" style={styles.inlineLink}>
                {t('item.playCta')}
              </ThemedText>
            </Link>
            <Link href={'/classements' as never}>
              <ThemedText type="small" style={styles.inlineLink}>
                {t('item.seeRankings')}
              </ThemedText>
            </Link>
            <Link href={'/privacy' as never}>
              <ThemedText type="small" style={styles.inlineLink}>
                {t('privacy.title')}
              </ThemedText>
            </Link>
          </View>

          {/* Contact */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('about.contactTitle')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('about.contactBody')}
            </ThemedText>
            <LinkRow
              testID="about-contact-link"
              icon="mail"
              label={SUPPORT_EMAIL}
              url={`mailto:${SUPPORT_EMAIL}`}
            />
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
  faqEntry: {
    gap: Spacing.one,
    paddingTop: Spacing.two,
  },
  faqQuestion: {
    fontWeight: '600',
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
