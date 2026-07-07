import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdSlot } from '@/ads/ad-slot';
import { MuteButton } from '@/components/mute-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ACCENT_COLOR, MaxContentWidth, Spacing } from '@/constants/theme';
import { t } from '@/lib/i18n';

const logo = require('../../assets/images/home_logo.png');

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
      <Ionicons name={icon} size={24} color={contentColor} />
      <ThemedText
        type="subtitle"
        style={[styles.buttonText, { color: contentColor }]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

export default function MenuScreen() {
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
        {Platform.OS !== 'web' && (
          <View style={styles.adHeader}>
            <AdSlot />
          </View>
        )}
        <View style={styles.topBar}>
          <MuteButton />
        </View>
        <View style={styles.hero}>
          <Image
            source={logo}
            style={styles.logo}
            contentFit="contain"
            accessibilityLabel={t('menu.title')}
          />
        </View>

        <View style={styles.menu}>
          <MenuButton
            label={t('menu.play')}
            href="/solo"
            icon="play"
            color="#e2523a"
          />
          <MenuButton
            label={t('menu.multiplayer')}
            href="/multiplayer"
            icon="people"
            color="#6db0f8"
          />
          <MenuButton label={t('solo.search')} href="/search" icon="search" />
          <MenuButton label={t('menu.history')} href="/history" icon="time" />
          <MenuButton
            label={t('menu.settings')}
            href="/settings"
            icon="settings"
          />
        </View>

        {/* Web: banner pinned to the bottom of the page. */}
        {Platform.OS === 'web' && (
          <View style={styles.adFooter}>
            <AdSlot />
          </View>
        )}
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
    justifyContent: 'center',
    gap: Spacing.six,
  },
  topBar: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.four,
    zIndex: 1,
  },
  hero: {
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    maxWidth: 300,
    aspectRatio: 1,
  },
  menu: {
    gap: Spacing.three,
  },
  adHeader: {
    // Pins the banner to the page top despite justifyContent: 'center'.
    marginBottom: 'auto',
  },
  adFooter: {
    // Pins the banner to the page bottom despite justifyContent: 'center'.
    marginTop: 'auto',
  },
  button: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.six,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 22,
    lineHeight: 30,
  },
});
