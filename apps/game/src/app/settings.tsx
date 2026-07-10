import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactElement } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { ThemedSwitch } from '@/components/themed-switch';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { setLang, useT, type Lang } from '@/lib/i18n';
import { isMusicMuted, setMusicMuted } from '@/lib/music';
import {
  useAdsEnabled,
  useAuroraPulse,
  useShowLastVote,
  useShowResults,
} from '@/lib/prefs';
import { getSessionId } from '@/lib/session';
import { isSfxMuted, setSfxMuted } from '@/lib/sfx';

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t, lang } = useT();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { showResults, setShowResults } = useShowResults();
  const { showLastVote, setShowLastVote } = useShowLastVote();
  const { adsEnabled, setAdsEnabled } = useAdsEnabled();
  const { auroraPulse, setAuroraPulse } = useAuroraPulse();
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
            <ThemedSwitch
              testID="show-results-switch"
              value={showResults}
              onValueChange={setShowResults}
            />
          </View>
          <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.rowLabel}>
              {t('settings.showLastVote')}
            </ThemedText>
            <ThemedSwitch
              testID="show-last-vote-switch"
              value={showLastVote}
              onValueChange={setShowLastVote}
            />
          </View>
        </View>

        {/* Appearance */}
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('settings.appearance')}
          </ThemedText>
          <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.rowLabel}>
              {t('settings.auroraPulse')}
            </ThemedText>
            <ThemedSwitch
              testID="aurora-pulse-switch"
              value={auroraPulse}
              onValueChange={setAuroraPulse}
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
              <ThemedSwitch
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
              <ThemedSwitch
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

        {/* Language */}
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('settings.language')}
          </ThemedText>
          {LANGUAGES.map(({ code, label, Flag }) => (
            <Pressable
              key={code}
              testID={`lang-${code}`}
              onPress={() => setLang(code)}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: theme.backgroundElement,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <View style={styles.languageLabel}>
                <Flag />
                <ThemedText>{label}</ThemedText>
              </View>
              {lang === code && (
                <ThemedText type="small" themeColor="textSecondary">
                  ✓
                </ThemedText>
              )}
            </Pressable>
          ))}
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
            <ThemedSwitch
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

// SVG flags instead of emoji: Windows/Chrome ships no flag glyphs and
// renders regional-indicator pairs as bare "FR" letters.
function FrenchFlag() {
  return (
    <Svg width={22} height={16} viewBox="0 0 3 2">
      <Rect width={1} height={2} x={0} fill="#002654" />
      <Rect width={1} height={2} x={1} fill="#ffffff" />
      <Rect width={1} height={2} x={2} fill="#ED2939" />
    </Svg>
  );
}

// Simplified Union Jack (no diagonal offsets at this size).
function BritishFlag() {
  return (
    <Svg width={22} height={16} viewBox="0 0 60 40">
      <Rect width={60} height={40} fill="#012169" />
      <Path d="M0,0 L60,40 M60,0 L0,40" stroke="#ffffff" strokeWidth={8} />
      <Path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" strokeWidth={3} />
      <Path d="M30,0 V40 M0,20 H60" stroke="#ffffff" strokeWidth={13} />
      <Path d="M30,0 V40 M0,20 H60" stroke="#C8102E" strokeWidth={8} />
    </Svg>
  );
}

// Portugal without the coat of arms; the circle stands in for the sphere.
function PortugueseFlag() {
  return (
    <Svg width={22} height={16} viewBox="0 0 30 20">
      <Rect width={30} height={20} fill="#DA291C" />
      <Rect width={12} height={20} fill="#046A38" />
      <Circle cx={12} cy={10} r={3.5} fill="#FFE900" />
    </Svg>
  );
}

// Spain without the coat of arms.
function SpanishFlag() {
  return (
    <Svg width={22} height={16} viewBox="0 0 30 20">
      <Rect width={30} height={20} fill="#AA151B" />
      <Rect y={5} width={30} height={10} fill="#F1BF00" />
    </Svg>
  );
}

function GermanFlag() {
  return (
    <Svg width={22} height={16} viewBox="0 0 30 21">
      <Rect width={30} height={7} y={0} fill="#000000" />
      <Rect width={30} height={7} y={7} fill="#DD0000" />
      <Rect width={30} height={7} y={14} fill="#FFCC00" />
    </Svg>
  );
}

function DutchFlag() {
  return (
    <Svg width={22} height={16} viewBox="0 0 30 21">
      <Rect width={30} height={7} y={0} fill="#AE1C28" />
      <Rect width={30} height={7} y={7} fill="#ffffff" />
      <Rect width={30} height={7} y={14} fill="#21468B" />
    </Svg>
  );
}

// Native names on purpose: a player who can't read the current language
// must still be able to find their own.
const LANGUAGES: Array<{ code: Lang; label: string; Flag: () => ReactElement }> =
  [
    { code: 'fr', label: 'Français', Flag: FrenchFlag },
    { code: 'en', label: 'English', Flag: BritishFlag },
    { code: 'pt', label: 'Português', Flag: PortugueseFlag },
    { code: 'es', label: 'Español', Flag: SpanishFlag },
    { code: 'de', label: 'Deutsch', Flag: GermanFlag },
    { code: 'nl', label: 'Nederlands', Flag: DutchFlag },
  ];

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
