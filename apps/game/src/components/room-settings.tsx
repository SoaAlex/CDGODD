import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import type { RoomMode } from '@cdgodd/shared';
import { CategoryFilter } from '@/components/category-filter';
import { RIGHT_COLOR } from '@/components/swipe-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/lib/i18n';

export const MIN_ROUND_SIZE = 5;
export const MAX_ROUND_SIZE = 50;
const ROUND_SIZE_STEP = 5;

/**
 * Mode + round-size + category rows, shared between room creation and the
 * host's replay screen so both configure a round the same way.
 */
export function RoomSettings({
  mode,
  roundSize,
  categoryKeys,
  onModeChange,
  onRoundSizeChange,
  onCategoryKeysChange,
}: {
  mode: RoomMode;
  roundSize: number;
  categoryKeys: string[];
  onModeChange: (mode: RoomMode) => void;
  onRoundSizeChange: (roundSize: number) => void;
  onCategoryKeysChange: (keys: string[]) => void;
}) {
  const theme = useTheme();
  const chip = (selected: boolean) => ({
    backgroundColor: selected ? RIGHT_COLOR : theme.backgroundElement,
  });
  const chipText = (selected: boolean) => (selected ? { color: '#fff' } : null);

  const stepButton = (disabled: boolean) => ({
    backgroundColor: theme.backgroundElement,
    opacity: disabled ? 0.4 : 1,
  });

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

      {/* 5-50 cards, ±5 per tap. */}
      <View style={styles.stepperRow}>
        <Pressable
          testID="size-minus"
          onPress={() =>
            onRoundSizeChange(
              Math.max(MIN_ROUND_SIZE, roundSize - ROUND_SIZE_STEP),
            )
          }
          disabled={roundSize <= MIN_ROUND_SIZE}
          style={[styles.stepButton, stepButton(roundSize <= MIN_ROUND_SIZE)]}
        >
          <Ionicons name="remove" size={20} color={theme.text} />
        </Pressable>
        <ThemedText style={styles.stepperValue}>
          {roundSize} {t('multiplayer.cards')}
        </ThemedText>
        <Pressable
          testID="size-plus"
          onPress={() =>
            onRoundSizeChange(
              Math.min(MAX_ROUND_SIZE, roundSize + ROUND_SIZE_STEP),
            )
          }
          disabled={roundSize >= MAX_ROUND_SIZE}
          style={[styles.stepButton, stepButton(roundSize >= MAX_ROUND_SIZE)]}
        >
          <Ionicons name="add" size={20} color={theme.text} />
        </Pressable>
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        {t('filter.categoriesLabel')}
      </ThemedText>
      <CategoryFilter selected={categoryKeys} onChange={onCategoryKeysChange} />
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
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  stepButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
  },
  stepperValue: {
    minWidth: 96,
    textAlign: 'center',
  },
});
