import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { Gradient, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';
import { useAdConsent, useAdsEnabled, type AdConsent } from '@/lib/prefs';
import { WEB_ADS_CONFIGURED } from './adsterra';

/**
 * Web: first-party ad-cookie consent banner (CNIL rules: no ad script loads
 * before a choice, refusing is exactly as easy and as prominent as
 * accepting, and the choice can be changed any time in settings). Shown
 * only when the build serves ads, the visitor hasn't turned ads off, and no
 * choice is stored yet — so ad-free builds (local dev, e2e) never show it.
 */
export function ConsentBanner() {
  const theme = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const { adsEnabled, loaded } = useAdsEnabled();
  const { consent, loaded: consentLoaded, setConsent } = useAdConsent();

  if (!WEB_ADS_CONFIGURED || !loaded || !adsEnabled || !consentLoaded) {
    return null;
  }
  if (consent !== null) return null;

  // Same style for both buttons on purpose: no nudging towards "accept".
  const button = (choice: AdConsent, label: string) => (
    <Pressable
      testID={`consent-${choice === 'granted' ? 'accept' : 'refuse'}`}
      onPress={() => setConsent(choice)}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? theme.surfacePressed : theme.surface },
      ]}
    >
      <ThemedText
        type="smallBold"
        style={[styles.buttonLabel, { color: theme.textOnSurface }]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );

  return (
    <View
      style={[styles.wrap, { paddingBottom: insets.bottom + Spacing.three }]}
      pointerEvents="box-none"
    >
      <View
        testID="consent-banner"
        accessibilityRole="alert"
        style={styles.card}
      >
        <ThemedText type="small">{t('consent.bannerBody')}</ThemedText>
        <Link href={'/privacy' as never}>
          <ThemedText type="small" style={styles.link}>
            {t('privacy.title')}
          </ThemedText>
        </Link>
        <View style={styles.buttons}>
          {button('denied', t('consent.refuse'))}
          {button('granted', t('consent.accept'))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
  },
  card: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    backgroundColor: Gradient[1],
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.35)',
  },
  link: {
    textDecorationLine: 'underline',
    opacity: 0.9,
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
  },
  buttonLabel: {
    textAlign: 'center',
  },
});
