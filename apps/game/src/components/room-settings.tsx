import { Pressable, StyleSheet, View } from 'react-native';
import type { RoomMode } from '@cdgodd/shared';
import { RIGHT_COLOR } from '@/components/swipe-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/lib/i18n';

export const ROUND_SIZES = [5, 10, 20] as const;

/**
 * Mode + round-size chip rows, shared between room creation and the host's
 * replay screen so both configure a round the same way.
 */
export function RoomSettings({
  mode,
  roundSize,
  onModeChange,
  onRoundSizeChange,
}: {
  mode: RoomMode;
  roundSize: number;
  onModeChange: (mode: RoomMode) => void;
  onRoundSizeChange: (roundSize: number) => void;
}) {
  const theme = useTheme();
  const chip = (selected: boolean) => ({
    backgroundColor: selected ? RIGHT_COLOR : theme.backgroundElement,
  });
  const chipText = (selected: boolean) => (selected ? { color: '#fff' } : null);

  return (
    <>
      <View style={styles.chipRow}>
        {(['batch', 'live'] as const).map((m) => (
          <Pressable
            key={m}
            testID={`mode-${m}`}
            onPress={() => onModeChange(m)}
            style={[styles.chip, chip(mode === m)]}
          >
            <ThemedText type="small" style={chipText(mode === m)}>
              {m === 'batch'
                ? t('multiplayer.modeBatch')
                : t('multiplayer.modeLive')}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <View style={styles.chipRow}>
        {ROUND_SIZES.map((n) => (
          <Pressable
            key={n}
            testID={`size-${n}`}
            onPress={() => onRoundSizeChange(n)}
            style={[styles.chip, chip(roundSize === n)]}
          >
            <ThemedText type="small" style={chipText(roundSize === n)}>
              {n} {t('multiplayer.cards')}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
  },
});
