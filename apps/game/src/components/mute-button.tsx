import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/lib/i18n';
import { isMusicMuted, setMusicMuted } from '@/lib/music';
import { isSfxMuted, setSfxMuted } from '@/lib/sfx';

/**
 * Sound menu: a single icon that drops down into separate music and sound
 * effect toggles. Web only — audio doesn't play on native, so the button
 * renders nothing there.
 */
export function MuteButton() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [musicMuted, setMusicMutedState] = useState(isMusicMuted());
  const [sfxMuted, setSfxMutedState] = useState(isSfxMuted());
  if (Platform.OS !== 'web') return null;

  const allMuted = musicMuted && sfxMuted;

  function toggleMusic(on: boolean) {
    setMusicMuted(!on);
    setMusicMutedState(!on);
  }

  function toggleSfx(on: boolean) {
    setSfxMuted(!on);
    setSfxMutedState(!on);
  }

  return (
    <View>
      <Pressable
        testID="mute-music"
        onPress={() => setOpen((v) => !v)}
        accessibilityLabel={t('settings.sound')}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Ionicons
          name={allMuted ? 'volume-mute' : 'volume-high'}
          size={20}
          color={theme.textSecondary}
        />
      </Pressable>
      {open && (
        <View style={[styles.menu, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.menuRow}>
            <ThemedText type="small" style={styles.menuLabel}>
              {t('settings.music')}
            </ThemedText>
            <Switch
              testID="toggle-music"
              value={!musicMuted}
              onValueChange={toggleMusic}
            />
          </View>
          <View style={styles.menuRow}>
            <ThemedText type="small" style={styles.menuLabel}>
              {t('settings.soundEffects')}
            </ThemedText>
            <Switch
              testID="toggle-sfx"
              value={!sfxMuted}
              onValueChange={toggleSfx}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  menu: {
    position: 'absolute',
    top: 44,
    right: 0,
    minWidth: 210,
    borderRadius: Spacing.two,
    padding: Spacing.two,
    gap: Spacing.two,
    zIndex: 10,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  menuLabel: {
    flex: 1,
  },
});
