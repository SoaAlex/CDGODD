import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdSlot } from '@/ads/ad-slot';
import { BetaBadge } from '@/components/beta-badge';
import { MuteButton } from '@/components/mute-button';
import { NowPlaying } from '@/components/now-playing';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  ACCENT_COLOR,
  Fonts,
  LEFT_COLOR,
  MaxContentWidth,
  RIGHT_COLOR,
  Spacing,
  TEXT_SHADOW,
} from '@/constants/theme';
import { useT } from '@/lib/i18n';

function MenuButton({
  label,
  href,
  icon,
  color,
}: {
  label: string;
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Filled accent color; default is a white surface with dark content. */
  color?: string;
}) {
  const router = useRouter();
  const filled = color !== undefined;
  const backgroundColor = color ?? '#fff';
  const contentColor = filled ? '#fff' : ACCENT_COLOR;
  return (
    <Pressable
      onPress={() => router.push(href as never)}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={22} color={contentColor} />
      <ThemedText
        type="subtitle"
        style={[styles.buttonText, { color: contentColor }]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

/**
 * Version shown in the footer. In CI the deploy workflow injects the semver the
 * commit is about to be tagged with (EXPO_PUBLIC_APP_VERSION); locally it falls
 * back to the static app.json version. `||` so an empty injected value also
 * falls back.
 */
const APP_VERSION =
  process.env.EXPO_PUBLIC_APP_VERSION || Constants.expoConfig?.version || '';

export default function MenuScreen() {
  const { t } = useT();
  return (
    <ThemedView style={styles.container}>
      <Head>
        <title>{t('menu.title')}</title>
        <meta
          name="description"
          content="Classe des objets et concepts entre la gauche et la droite."
        />
      </Head>
      <SafeAreaView style={styles.safeArea}>
        {/* Mobile: banner pinned to the top of the menu. */}
        {Platform.OS !== 'web' && <AdSlot />}
        <View style={styles.topBar}>
          <NowPlaying />
          <MuteButton />
        </View>
        {/* Centered between the (possibly empty) ad slots. */}
        <View style={styles.content}>
          <View style={styles.hero}>
            <View style={styles.titleWrap}>
              <Text
                style={styles.logo}
                accessibilityLabel={t('menu.title')}
                allowFontScaling={false}
              >
                <Text style={styles.logoWhite}>C’EST DE{'\n'}</Text>
                <Text style={styles.logoGauche}>GAUCHE{'\n'}</Text>
                <Text style={styles.logoWhite}>OU DE{'\n'}</Text>
                <Text style={styles.logoDroite}>DROITE</Text>
                <Text style={styles.logoWhite}> ?</Text>
              </Text>
              <BetaBadge />
            </View>
          </View>

          <View style={styles.menu}>
            <MenuButton
              label={t('menu.play')}
              href="/solo"
              icon="play"
              color={LEFT_COLOR}
            />
            <MenuButton
              label={t('menu.multiplayer')}
              href="/multiplayer"
              icon="people"
              color={RIGHT_COLOR}
            />
            <MenuButton label={t('solo.search')} href="/search" icon="search" />
            <MenuButton label={t('menu.history')} href="/history" icon="time" />
            <MenuButton
              label={t('menu.settings')}
              href="/settings"
              icon="settings"
            />
            <MenuButton
              label={t('menu.credits')}
              href="/credits"
              icon="information-circle"
            />
          </View>
        </View>

        {/* Web: banner at the bottom of the page. */}
        {Platform.OS === 'web' && <AdSlot />}

        {/* Version footer. Kept flagged "beta" while the game is still in
            development, even after main releases. */}
        <ThemedText type="small" style={styles.version} allowFontScaling={false}>
          v{APP_VERSION} · {t('menu.beta')}
        </ThemedText>
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
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  content: {
    // Fills the space between the ad slots so hero + menu stay centered
    // whether or not an ad actually renders.
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.six,
  },
  topBar: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.four,
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  hero: {
    alignItems: 'center',
    // Keeps the beta tooltip painting above the menu buttons below.
    position: 'relative',
    zIndex: 10,
  },
  titleWrap: {
    // Shrinks to the width of the title so the beta badge can anchor to its
    // top-right corner instead of the full-width hero (which collides with the
    // now-playing / mute controls).
    alignSelf: 'center',
    position: 'relative',
  },
  logo: {
    fontFamily: Fonts.display,
    fontWeight: '700',
    fontSize: 52,
    lineHeight: 56,
    letterSpacing: 1,
    textAlign: 'center',
    ...TEXT_SHADOW,
  },
  logoWhite: {
    color: '#ffffff',
  },
  logoGauche: {
    color: LEFT_COLOR,
  },
  logoDroite: {
    color: RIGHT_COLOR,
  },
  menu: {
    gap: Spacing.three,
  },
  button: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: 12,
    borderRadius: Spacing.six,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 20,
    lineHeight: 28,
  },
  version: {
    textAlign: 'center',
    opacity: 0.6,
    letterSpacing: 0.5,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },
});
