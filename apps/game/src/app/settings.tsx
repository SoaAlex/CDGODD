import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect } from 'react-native-svg';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/lib/i18n';
import { isMusicMuted, setMusicMuted } from '@/lib/music';
import { useAdsEnabled, useShowResults } from '@/lib/prefs';
import { getSessionId } from '@/lib/session';
import { isSfxMuted, setSfxMuted } from '@/lib/sfx';

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { showResults, setShowResults } = useShowResults();
  const { adsEnabled, setAdsEnabled } = useAdsEnabled();
  const [musicMuted, setMusicMutedState] = useState(isMusicMuted());
  const [sfxMuted, setSfxMutedState] = useState(isSfxMuted());

  useEffect(() => {
    void getSessionId().then(setSessionId);
  }, []);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        {/* Gameplay */}
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('menu.play')}
          </ThemedText>
          <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.rowLabel}>
              {t('settings.showResults')}
            </ThemedText>
            <Switch
              testID="show-results-switch"
              value={showResults}
              onValueChange={setShowResults}
            />
          </View>
        </View>

        {/* Sound — audio is a web-only flourish, so hide the section on native. */}
        {Platform.OS === 'web' && (
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('settings.sound')}
            </ThemedText>
            <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={styles.rowLabel}>{t('settings.music')}</ThemedText>
              <Switch
                testID="music-switch"
                value={!musicMuted}
                onValueChange={(on) => {
                  setMusicMuted(!on);
                  setMusicMutedState(!on);
                }}
              />
            </View>
            <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={styles.rowLabel}>
                {t('settings.soundEffects')}
              </ThemedText>
              <Switch
                testID="sfx-switch"
                value={!sfxMuted}
                onValueChange={(on) => {
                  setSfxMuted(!on);
                  setSfxMutedState(!on);
                }}
              />
            </View>
          </View>
        )}

        {/* Language — French only for now; the i18n layer is ready for more. */}
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('settings.language')}
          </ThemedText>
          <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.languageLabel}>
              <FrenchFlag />
              <ThemedText>Français</ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              ✓
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {t('settings.moreLanguages')}
          </ThemedText>
        </View>

        {/* Anonymous session */}
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('settings.anonymity')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('settings.sessionHint')}
          </ThemedText>
          {sessionId && (
            <ThemedText type="code" themeColor="textSecondary" selectable>
              {sessionId}
            </ThemedText>
          )}
        </View>

        {/* Ads & privacy */}
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('consent.title')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('consent.body')}
          </ThemedText>
          <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small" style={styles.rowLabel}>
              {t('consent.adsToggle')}
            </ThemedText>
            <Switch
              testID="ads-enabled-switch"
              value={adsEnabled}
              onValueChange={setAdsEnabled}
            />
          </View>
        </View>

        {/* Credits */}
        <View style={styles.section}>
          <Pressable
            testID="credits-button"
            onPress={() => router.push('/credits')}
            style={({ pressed }) => [
              styles.row,
              styles.button,
              {
                backgroundColor: theme.backgroundElement,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="heart" size={18} color={theme.text} />
              <ThemedText>{t('menu.credits')}</ThemedText>
            </View>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

// SVG tricolor instead of the 🇫🇷 emoji: Windows/Chrome ships no flag
// glyphs and renders regional-indicator pairs as bare "FR" letters.
function FrenchFlag() {
  return (
    <Svg width={22} height={16} viewBox="0 0 3 2">
      <Rect width={1} height={2} x={0} fill="#002654" />
      <Rect width={1} height={2} x={1} fill="#ffffff" />
      <Rect width={1} height={2} x={2} fill="#ED2939" />
    </Svg>
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
    padding: Spacing.four,
    gap: Spacing.five,
  },
  section: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  button: {
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    marginRight: Spacing.two,
  },
  languageLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
