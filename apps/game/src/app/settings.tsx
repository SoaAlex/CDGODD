import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/lib/i18n';
import { useShowResults } from '@/lib/prefs';
import { getSessionId, resetSessionId } from '@/lib/session';

export default function SettingsScreen() {
  const theme = useTheme();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [justReset, setJustReset] = useState(false);
  const { showResults, setShowResults } = useShowResults();

  useEffect(() => {
    void getSessionId().then(setSessionId);
  }, []);

  async function onReset() {
    const fresh = await resetSessionId();
    setSessionId(fresh);
    setJustReset(true);
  }

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

        {/* Language — French only for now; the i18n layer is ready for more. */}
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('settings.language')}
          </ThemedText>
          <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText>🇫🇷 Français</ThemedText>
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
          <Pressable
            testID="reset-session"
            onPress={onReset}
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
              <Ionicons
                name={justReset ? 'checkmark' : 'refresh'}
                size={18}
                color={theme.text}
              />
              <ThemedText>
                {justReset
                  ? t('settings.sessionReset')
                  : t('settings.resetSession')}
              </ThemedText>
            </View>
          </Pressable>
        </View>

        {/* Ads & privacy */}
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('consent.title')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('consent.body')}
          </ThemedText>
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
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
