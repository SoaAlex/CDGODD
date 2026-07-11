import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { parseCustomWords, type RoomMode } from '@cdgodd/shared';
import { CategoryFilter, type FilterMode } from '@/components/category-filter';
import { ThemedText } from '@/components/themed-text';
import { RIGHT_COLOR, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';

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
  categoryMatchAll,
  categoryFilterMode,
  customWordsText,
  includeDbItems,
  onModeChange,
  onRoundSizeChange,
  onCategoryKeysChange,
  onCategoryMatchAllChange,
  onCategoryFilterModeChange,
  onCustomWordsTextChange,
  onIncludeDbItemsChange,
}: {
  mode: RoomMode;
  roundSize: number;
  categoryKeys: string[];
  /** Items must belong to every selected category (default: at least one). */
  categoryMatchAll: boolean;
  /** Keep only the selected categories, or drop them. */
  categoryFilterMode: FilterMode;
  /** Raw comma-separated custom word list as typed by the host. */
  customWordsText: string;
  /** With custom words: also deal `roundSize` random DB items. */
  includeDbItems: boolean;
  onModeChange: (mode: RoomMode) => void;
  onRoundSizeChange: (roundSize: number) => void;
  onCategoryKeysChange: (keys: string[]) => void;
  onCategoryMatchAllChange: (matchAll: boolean) => void;
  onCategoryFilterModeChange: (mode: FilterMode) => void;
  onCustomWordsTextChange: (text: string) => void;
  onIncludeDbItemsChange: (include: boolean) => void;
}) {
  const { t } = useT();
  const theme = useTheme();
  const customWordCount = parseCustomWords(customWordsText).length;
  // The words field hides behind a button; a prefilled list (host replay)
  // starts open so the words are visible right away.
  const [wordsOpen, setWordsOpen] = useState(customWordCount > 0);
  // Custom-only round: the deck is exactly the words, the stepper is a no-op.
  const showStepper = customWordCount === 0 || includeDbItems;
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

      {/* Host's own words, dealt as image-less cards: a button reveals the
          field; the word count and the DB-mix toggle appear once it has any. */}
      <View style={styles.chipRow}>
        <Pressable
          testID="custom-words-toggle"
          onPress={() => setWordsOpen((open) => !open)}
          style={[styles.chip, styles.wordsToggle, chip(wordsOpen)]}
        >
          <Ionicons
            name={wordsOpen ? 'chevron-up' : 'create-outline'}
            size={14}
            color={wordsOpen ? '#fff' : theme.text}
          />
          <ThemedText type="small" style={chipText(wordsOpen)}>
            {t('multiplayer.customWords')}
          </ThemedText>
        </Pressable>
        {customWordCount > 0 && (
          <>
            <Pressable
              testID="mix-db-items"
              onPress={() => onIncludeDbItemsChange(!includeDbItems)}
              style={[styles.chip, chip(includeDbItems)]}
            >
              <ThemedText type="small" style={chipText(includeDbItems)}>
                {t('multiplayer.mixDbItems')}
              </ThemedText>
            </Pressable>
            <ThemedText type="small" themeColor="textSecondary">
              {t('multiplayer.customWordsCount').replace(
                '{count}',
                String(customWordCount),
              )}
            </ThemedText>
          </>
        )}
      </View>
      {wordsOpen && (
        <TextInput
          testID="custom-words"
          value={customWordsText}
          onChangeText={onCustomWordsTextChange}
          placeholder={t('multiplayer.customWordsPlaceholder')}
          placeholderTextColor={theme.textSecondaryOnSurface}
          autoCorrect={false}
          multiline
          style={[
            styles.wordsInput,
            { backgroundColor: theme.surface, color: theme.textOnSurface },
          ]}
        />
      )}

      {/* 5-50 cards, ±5 per tap. */}
      {showStepper && (
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
      )}

      <ThemedText type="small" themeColor="textSecondary">
        {t('filter.categoriesLabel')}
      </ThemedText>
      <CategoryFilter
        selected={categoryKeys}
        onChange={onCategoryKeysChange}
        matchAll={categoryMatchAll}
        onMatchAllChange={onCategoryMatchAllChange}
        mode={categoryFilterMode}
        onModeChange={onCategoryFilterModeChange}
      />
    </>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  wordsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
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
  wordsInput: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    minHeight: 64,
    textAlignVertical: 'top',
  },
});
