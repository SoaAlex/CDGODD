import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LEFT_COLOR, RIGHT_COLOR } from '@/components/swipe-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/lib/i18n';

function MenuButton({
  label,
  href,
  icon,
  color,
}: {
  label: string;
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Filled accent color; default is the neutral surface. */
  color?: string;
}) {
  const theme = useTheme();
  const router = useRouter();
  const filled = color !== undefined;
  const contentColor = filled ? '#fff' : theme.text;
  return (
    <Pressable
      onPress={() => router.push(href as never)}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: color ?? theme.backgroundElement,
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
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.hero}>
          <View style={styles.titleRow}>
            <ThemedText type="title" style={{ color: LEFT_COLOR }}>
              Gauche
            </ThemedText>
            <ThemedText type="title"> ou </ThemedText>
            <ThemedText type="title" style={{ color: RIGHT_COLOR }}>
              Droite
            </ThemedText>
          </View>
          <ThemedText type="title">?</ThemedText>
        </View>

        <View style={styles.menu}>
          <MenuButton
            label={t('menu.play')}
            href="/solo"
            icon="play"
            color={RIGHT_COLOR}
          />
          <MenuButton
            label={t('menu.multiplayer')}
            href="/multiplayer"
            icon="people"
            color={LEFT_COLOR}
          />
          <MenuButton label={t('solo.search')} href="/search" icon="search" />
          <MenuButton label={t('menu.history')} href="/history" icon="time-outline" />
          <MenuButton
            label={t('menu.settings')}
            href="/settings"
            icon="settings-outline"
          />
        </View>
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
  hero: {
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  menu: {
    gap: Spacing.three,
  },
  button: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 22,
    lineHeight: 30,
  },
});
