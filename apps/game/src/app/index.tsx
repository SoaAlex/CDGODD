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
  primary,
  disabled,
}: {
  label: string;
  href: string;
  primary?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <Pressable
      disabled={disabled}
      onPress={() => router.push(href as never)}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: primary ? RIGHT_COLOR : theme.backgroundElement,
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
        },
      ]}
    >
      <ThemedText
        type="subtitle"
        style={[styles.buttonText, primary && { color: '#fff' }]}
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
          <MenuButton label={t('menu.play')} href="/solo" primary />
          {/* M4 + M5: */}
          <MenuButton label={t('menu.multiplayer')} href="/multiplayer" disabled />
          <MenuButton label={t('menu.settings')} href="/settings" disabled />
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
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 22,
    lineHeight: 30,
  },
});
