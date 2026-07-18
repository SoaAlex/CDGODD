import { Link } from 'expo-router';
import Head from 'expo-router/head';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinkRow } from '@/components/link-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';

const SUPPORT_EMAIL = 'support@cestdegaucheoudedroite.com';
const GOOGLE_PARTNER_SITES_URL =
  'https://policies.google.com/technologies/partner-sites';
const GOOGLE_ADS_SETTINGS_URL = 'https://adssettings.google.com';
const YOUR_ONLINE_CHOICES_URL = 'https://www.youronlinechoices.eu';

export default function PrivacyScreen() {
  const { t } = useT();
  return (
    <ThemedView style={styles.container}>
      <Head>
        <title>{t('privacy.title')}</title>
        <meta name="description" content={t('seo.privacyDesc')} />
      </Head>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Intro */}
          <View style={styles.section}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('privacy.updated')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('privacy.introBody')}
            </ThemedText>
          </View>

          {/* Who we are */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('privacy.whoTitle')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('privacy.whoBody')}
            </ThemedText>
          </View>

          {/* Data collected by the game */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('privacy.dataTitle')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('privacy.dataBody')}
            </ThemedText>
          </View>

          {/* Cookies & advertising */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('privacy.cookiesTitle')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('privacy.cookiesBody')}
            </ThemedText>
            <LinkRow
              testID="privacy-google-link"
              icon="logo-google"
              label={t('privacy.cookiesGoogleLink')}
              url={GOOGLE_PARTNER_SITES_URL}
            />
            <LinkRow
              testID="privacy-ads-settings-link"
              icon="options"
              label={t('privacy.cookiesPartnersLink')}
              url={GOOGLE_ADS_SETTINGS_URL}
            />
            <LinkRow
              testID="privacy-optout-link"
              icon="hand-left"
              label={t('privacy.cookiesOptOutLink')}
              url={YOUR_ONLINE_CHOICES_URL}
            />
          </View>

          {/* Consent & controls */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('privacy.consentTitle')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('privacy.consentBody')}
            </ThemedText>
            <Link href={'/settings' as never}>
              <ThemedText type="small" style={styles.inlineLink}>
                {t('menu.settings')}
              </ThemedText>
            </Link>
          </View>

          {/* Contact */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('privacy.contactTitle')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('privacy.contactBody')}
            </ThemedText>
            <LinkRow
              testID="privacy-contact-link"
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
  inlineLink: {
    textDecorationLine: 'underline',
    opacity: 0.9,
  },
});
