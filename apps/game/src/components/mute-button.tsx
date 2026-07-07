import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isMusicMuted, setMusicMuted } from '@/lib/music';

/**
 * Toggles the background music. Web only — music doesn't play on native,
 * so the button renders nothing there.
 */
export function MuteButton() {
  const theme = useTheme();
  const [muted, setMuted] = useState(isMusicMuted());
  if (Platform.OS !== 'web') return null;

  function toggle() {
    const next = !muted;
    setMusicMuted(next);
    setMuted(next);
  }

  return (
    <Pressable
      testID="mute-music"
      onPress={toggle}
      accessibilityLabel={muted ? 'Activer la musique' : 'Couper la musique'}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons
        name={muted ? 'volume-mute' : 'volume-high'}
        size={20}
        color={theme.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
