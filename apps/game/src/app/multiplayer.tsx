import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { FilterMode } from '@/components/category-filter';
import { RoomSettings } from '@/components/room-settings';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LEFT_COLOR, RIGHT_COLOR, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { createRoom } from '@/lib/api';
import { useT } from '@/lib/i18n';

export default function MultiplayerScreen() {
  const { t } = useT();
  const theme = useTheme();
  const router = useRouter();
  const [mode, setMode] = useState<'batch' | 'live'>('batch');
  const [roundSize, setRoundSize] = useState<number>(10);
  const [categoryKeys, setCategoryKeys] = useState<string[]>([]);
  const [categoryMatchAll, setCategoryMatchAll] = useState(false);
  // Include mode keeps the selected categories; exclude mode drops them.
  const [filterMode, setFilterMode] = useState<FilterMode>('include');
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanNickname = nickname.trim();
  const nameParam = `?name=${encodeURIComponent(cleanNickname)}`;

  async function onCreate() {
    setBusy(true);
    setError(null);
    try {
      const excluding = filterMode === 'exclude';
      const { room } = await createRoom(
        mode,
        roundSize,
        excluding ? [] : categoryKeys,
        categoryMatchAll ? 'all' : 'any',
        excluding ? categoryKeys : [],
      );
      router.push(`/room/${room.code}${nameParam}` as never);
    } catch {
      setError(t('errors.network'));
    } finally {
      setBusy(false);
    }
  }

  function onJoin() {
    const clean = code.trim().toUpperCase();
    if (clean.length === 6) router.push(`/room/${clean}${nameParam}` as never);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        {/* Nickname (shared by create & join, passed along to the room) */}
        <View style={styles.section}>
          <ThemedText type="subtitle">{t('multiplayer.nickname')}</ThemedText>
          <TextInput
            testID="nickname-input"
            value={nickname}
            onChangeText={setNickname}
            placeholder={t('multiplayer.nicknamePlaceholder')}
            placeholderTextColor={theme.textSecondaryOnSurface}
            autoCorrect={false}
            maxLength={24}
            style={[
              styles.input,
              { backgroundColor: theme.surface, color: theme.textOnSurface },
            ]}
          />
        </View>

        {/* Create */}
        <View style={styles.section}>
          <ThemedText type="subtitle">{t('multiplayer.create')}</ThemedText>

          <RoomSettings
            mode={mode}
            roundSize={roundSize}
            categoryKeys={categoryKeys}
            categoryMatchAll={categoryMatchAll}
            categoryFilterMode={filterMode}
            onModeChange={setMode}
            onRoundSizeChange={setRoundSize}
            onCategoryKeysChange={setCategoryKeys}
            onCategoryMatchAllChange={setCategoryMatchAll}
            onCategoryFilterModeChange={setFilterMode}
          />

          <Pressable
            testID="create-room"
            onPress={onCreate}
            disabled={busy || !cleanNickname}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: RIGHT_COLOR,
                opacity: !cleanNickname ? 0.4 : busy || pressed ? 0.7 : 1,
              },
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
            placeholderTextColor={theme.textSecondaryOnSurface}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            style={[
              styles.input,
              { backgroundColor: theme.surface, color: theme.textOnSurface },
            ]}
          />
          <Pressable
            testID="join-room"
            onPress={onJoin}
            disabled={code.trim().length !== 6 || !cleanNickname}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: LEFT_COLOR,
                opacity:
                  code.trim().length !== 6 || !cleanNickname
                    ? 0.4
                    : pressed
                      ? 0.7
                      : 1,
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
