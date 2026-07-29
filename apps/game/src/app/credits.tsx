import { Link } from 'expo-router';
import Head from 'expo-router/head';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinkRow } from '@/components/link-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';

const REMIX_URL =
  'https://soundcloud.com/tomaly-546558255/chirac-je-serai-le-president-de-tous-les-francais-thomaslyy-house-remix';
const ORIGINAL_URL = 'https://www.youtube.com/watch?v=K8uo_SJ_PKA';
const SUPPORT_EMAIL = 'support@cestdegaucheoudedroite.com';

export default function CreditsScreen() {
  const { t } = useT();
  return (
    <ThemedView style={styles.container}>
      <Head>
        <title>{t('menu.credits')}</title>
        <meta name="description" content={t('seo.creditsDesc')} />
      </Head>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Game & images — AI generated */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('credits.aiTitle')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('credits.aiBody')}
            </ThemedText>
            <Link href={'/a-propos' as never}>
              <ThemedText type="small" style={styles.inlineLink}>
                {t('about.title')}
              </ThemedText>
            </Link>
          </View>

          {/* Special thanks */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('credits.thanksTitle')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('credits.thanksBody')}
            </ThemedText>
          </View>

          {/* Music */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('credits.musicTitle')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('credits.musicBody')}
            </ThemedText>
            <LinkRow
              testID="credits-remix-link"
              icon="musical-notes"
              label={t('credits.musicRemixLink')}
              url={REMIX_URL}
            />
            <LinkRow
              testID="credits-original-link"
              icon="logo-youtube"
              label={t('credits.musicOriginalLink')}
              url={ORIGINAL_URL}
            />
          </View>

          {/* Privacy */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('credits.privacyTitle')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('credits.privacyBody')}
            </ThemedText>
            <Link href={'/privacy' as never}>
              <ThemedText type="small" style={styles.inlineLink}>
                {t('privacy.title')}
              </ThemedText>
            </Link>
          </View>

          {/* Disclaimer */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('credits.disclaimerTitle')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('credits.disclaimerBody')}
            </ThemedText>
          </View>

          {/* Reporting & takedown */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('credits.takedownTitle')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('credits.takedownBody')}
            </ThemedText>
          </View>

          {/* Contact */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('credits.contactTitle')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('credits.contactBody')}
            </ThemedText>
            <LinkRow
              testID="credits-contact-link"
              icon="mail"
              label={SUPPORT_EMAIL}
              url={`mailto:${SUPPORT_EMAIL}`}
            />
          </View>

          {/* Legal notice (LCEN mentions légales) */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('credits.legalTitle')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('credits.legalBody')}
            </ThemedText>
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
  inlineLink: {
    textDecorationLine: 'underline',
    opacity: 0.9,
  },
});
