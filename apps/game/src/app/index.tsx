import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Link } from 'expo-router';
import Head from 'expo-router/head';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdSlot } from '@/ads/ad-slot';
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
  const filled = color !== undefined;
  const backgroundColor = color ?? '#fff';
  const contentColor = filled ? '#fff' : ACCENT_COLOR;
  return (
    // Link + asChild renders a real <a href> on web (react-native-web passes
    // `href` through to the anchor) so the navigation is crawlable, unlike
    // router.push which leaves no links in the static HTML. The style must be
    // a single static object: asChild's prop merge drops function styles and
    // mangles arrays, so flatten before passing.
    <Link href={href as never} asChild>
      <Pressable style={StyleSheet.flatten([styles.button, { backgroundColor }])}>
        <Ionicons name={icon} size={22} color={contentColor} />
        <ThemedText
          type="subtitle"
          style={[styles.buttonText, { color: contentColor }]}
        >
          {label}
        </ThemedText>
      </Pressable>
    </Link>
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
        <meta name="description" content={t('seo.homeDesc')} />
      </Head>
      <SafeAreaView style={styles.safeArea}>
        {/* Mobile: banner pinned to the top of the menu. */}
        {Platform.OS !== 'web' && <AdSlot />}
        {/* Static row (not absolutely positioned) so the sound controls
            always reserve their own vertical space instead of overlapping
            the title on short/narrow viewports. Web only: both children
            render null on native, which would leave an empty padded row. */}
        {Platform.OS === 'web' && (
          <View style={styles.topBar}>
            <NowPlaying />
            <MuteButton />
          </View>
        )}
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Fills the viewport so hero + menu stay centered; the about text
              sits below the fold and scrolls into view. */}
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

          {/* Editorial description of the game: real publisher content for
              visitors, crawlers and ad reviewers alike. */}
          <View style={styles.about}>
            <ThemedText type="subtitle" style={styles.aboutTitle}>
              {t('home.aboutTitle')}
            </ThemedText>
            <ThemedText type="small" style={styles.aboutBody}>
              {t('home.aboutWhat')}
            </ThemedText>
            <ThemedText type="small" style={styles.aboutBody}>
              {t('home.aboutHow')}
            </ThemedText>
            <ThemedText type="small" style={styles.aboutBody}>
              {t('home.aboutStats')}
            </ThemedText>
          </View>

          {/* NOTE: the web AdSense banner that used to live here was removed
              while the site is under AdSense review (a menu page counts as
              "screen without publisher content"). Re-add after approval. */}

          {/* Footer: legal links as real anchors + version. */}
          <View style={styles.footerLinks}>
            <Link href={'/items' as never}>
              <ThemedText type="small" style={styles.footerLink}>
                {t('menu.browse')}
              </ThemedText>
            </Link>
            <ThemedText type="small" style={styles.footerDot}>
              ·
            </ThemedText>
            <Link href={'/privacy' as never}>
              <ThemedText type="small" style={styles.footerLink}>
                {t('menu.privacy')}
              </ThemedText>
            </Link>
            <ThemedText type="small" style={styles.footerDot}>
              ·
            </ThemedText>
            <Link href={'/credits' as never}>
              <ThemedText type="small" style={styles.footerLink}>
                {t('menu.credits')}
              </ThemedText>
            </Link>
          </View>
          <ThemedText
            type="small"
            style={styles.version}
            allowFontScaling={false}
          >
            v{APP_VERSION}
          </ThemedText>
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
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  scroll: {
    flexGrow: 1,
  },
  content: {
    // Fills the first viewport so hero + menu stay centered whether or not
    // anything renders below the fold.
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.six,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
  hero: {
    alignItems: 'center',
  },
  titleWrap: {
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
  about: {
    paddingTop: Spacing.six,
    gap: Spacing.three,
  },
  aboutTitle: {
    textAlign: 'center',
  },
  aboutBody: {
    opacity: 0.85,
    textAlign: 'center',
    lineHeight: 20,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingTop: Spacing.five,
  },
  footerLink: {
    opacity: 0.8,
    textDecorationLine: 'underline',
  },
  footerDot: {
    opacity: 0.5,
  },
  version: {
    textAlign: 'center',
    opacity: 0.6,
    letterSpacing: 0.5,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },
});
