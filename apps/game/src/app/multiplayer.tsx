import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RoomSettings } from '@/components/room-settings';
import { LEFT_COLOR, RIGHT_COLOR } from '@/components/swipe-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { createRoom } from '@/lib/api';
import { t } from '@/lib/i18n';

export default function MultiplayerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [mode, setMode] = useState<'batch' | 'live'>('batch');
  const [roundSize, setRoundSize] = useState<number>(10);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    setBusy(true);
    setError(null);
    try {
      const { room } = await createRoom(mode, roundSize);
      router.push(`/room/${room.code}` as never);
    } catch {
      setError(t('errors.network'));
    } finally {
      setBusy(false);
    }
  }

  function onJoin() {
    const clean = code.trim().toUpperCase();
    if (clean.length === 6) router.push(`/room/${clean}` as never);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        {/* Create */}
        <View style={styles.section}>
          <ThemedText type="subtitle">{t('multiplayer.create')}</ThemedText>

          <RoomSettings
            mode={mode}
            roundSize={roundSize}
            onModeChange={setMode}
            onRoundSizeChange={setRoundSize}
          />

          <Pressable
            testID="create-room"
            onPress={onCreate}
            disabled={busy}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: RIGHT_COLOR, opacity: busy || pressed ? 0.7 : 1 },
            ]}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="add-circle-outline" size={22} color="#fff" />
              <ThemedText type="subtitle" style={styles.primaryText}>
                {t('multiplayer.create')}
              </ThemedText>
            </View>
          </Pressable>
        </View>

        {/* Join */}
        <View style={styles.section}>
          <ThemedText type="subtitle">{t('multiplayer.join')}</ThemedText>
          <TextInput
            testID="join-code"
            value={code}
            onChangeText={setCode}
            placeholder={t('multiplayer.codePlaceholder')}
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            style={[
              styles.input,
              { backgroundColor: theme.backgroundElement, color: theme.text },
            ]}
          />
          <Pressable
            testID="join-room"
            onPress={onJoin}
            disabled={code.trim().length !== 6}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: LEFT_COLOR,
                opacity: code.trim().length !== 6 ? 0.4 : pressed ? 0.7 : 1,
              },
            ]}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="enter-outline" size={22} color="#fff" />
              <ThemedText type="subtitle" style={styles.primaryText}>
                {t('multiplayer.join')}
              </ThemedText>
            </View>
          </Pressable>
        </View>

        {error && (
          <ThemedText style={{ color: '#e63946', textAlign: 'center' }}>
            {error}
          </ThemedText>
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
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing.four,
    gap: Spacing.six,
    justifyContent: 'center',
  },
  section: {
    gap: Spacing.three,
  },
  primaryButton: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  primaryText: {
    color: '#fff',
  },
  input: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 22,
    textAlign: 'center',
  },
});
