import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { LEFT_COLOR, RIGHT_COLOR, Spacing } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';

/** Opaque card color for the picker (blend of the brand gradient). */
const SHEET_BG = '#565393';

/** How the selected keys apply: keep only those items, or drop them. */
export type FilterMode = 'include' | 'exclude';

/**
 * Category filter as a dropdown: a compact trigger showing the current
 * selection opens a modal multi-select list (scales to many categories).
 * An empty selection means "all categories". Renders nothing until the
 * category list loads.
 */
export function CategoryFilter({
  selected,
  onChange,
  matchAll = false,
  onMatchAllChange,
  mode = 'include',
  onModeChange,
  centered = false,
}: {
  selected: string[];
  onChange: (keys: string[]) => void;
  /** Items must belong to every selected category (default: at least one). */
  matchAll?: boolean;
  onMatchAllChange?: (matchAll: boolean) => void;
  /** Keep only the selected categories, or drop them (default: include). */
  mode?: FilterMode;
  /** When set, the sheet offers an include/exclude mode switch. */
  onModeChange?: (mode: FilterMode) => void;
  /** Center the trigger (solo header); default left-aligns (settings forms). */
  centered?: boolean;
}) {
  const { t } = useT();
  const { categories, total } = useCategories();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  if (categories.length === 0) return null;

  function toggle(key: string) {
    onChange(
      selected.includes(key)
        ? selected.filter((k) => k !== key)
        : [...selected, key],
    );
  }

  // Trigger label: "Toutes", the names when short, a count when not.
  // Exclude mode prefixes with "Sans" so the trigger reads as a negation.
  const excluding = mode === 'exclude';
  const allSelected =
    categories.length > 0 && selected.length === categories.length;
  const selectedNames = categories
    .filter(({ key }) => selected.includes(key))
    .map(({ name }) => name);
  const names =
    selectedNames.length <= 2
      ? selectedNames.join(' · ')
      : `${selectedNames.length} ${t('filter.categoriesLabel').toLowerCase()}`;
  const label =
    selectedNames.length === 0
      ? t('filter.allCategories')
      : excluding
        ? `${t('filter.without')} ${names}`
        : names;

  const row = (isSelected: boolean, key: string, name: string, count: number) => (
    <Pressable
      key={key}
      testID={`category-${key}`}
      onPress={() => (key === 'all' ? onChange([]) : toggle(key))}
      style={({ pressed }) => [
        styles.option,
        (isSelected || pressed) && {
          backgroundColor: theme.backgroundElement,
        },
      ]}
    >
      <ThemedText>{`${name} (${count})`}</ThemedText>
      {isSelected && <Ionicons name="checkmark" size={18} color="#fff" />}
    </Pressable>
  );

  return (
    <View style={centered && styles.centered}>
      <Pressable
        testID="category-filter-trigger"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor:
              selected.length > 0
                ? excluding
                  ? LEFT_COLOR
                  : RIGHT_COLOR
                : theme.backgroundElement,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Ionicons name="funnel-outline" size={14} color="#fff" />
        <ThemedText type="small" style={styles.triggerText} numberOfLines={1}>
          {label}
        </ThemedText>
        <Ionicons name="chevron-down" size={14} color="#fff" />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          testID="category-filter-backdrop"
          style={styles.backdrop}
          onPress={() => setOpen(false)}
        >
          {/* Stop backdrop presses from closing when tapping the sheet. */}
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ThemedText type="subtitle" style={styles.sheetTitle}>
              {t('filter.categoriesLabel')}
            </ThemedText>
            {/* Include/exclude switch — how the checked categories apply. */}
            {onModeChange && (
              <View style={styles.modeRow}>
                {(['include', 'exclude'] as const).map((m) => (
                  <Pressable
                    key={m}
                    testID={`category-filter-mode-${m}`}
                    onPress={() => onModeChange(m)}
                    style={[
                      styles.modeChip,
                      {
                        backgroundColor:
                          mode === m
                            ? m === 'exclude'
                              ? LEFT_COLOR
                              : RIGHT_COLOR
                            : theme.backgroundElement,
                      },
                    ]}
                  >
                    <ThemedText type="small">
                      {m === 'include'
                        ? t('filter.modeInclude')
                        : t('filter.modeExclude')}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            )}
            {/* Check every category (then untick a few) or start over. */}
            <Pressable
              testID="category-filter-select-all"
              onPress={() =>
                onChange(
                  allSelected ? [] : categories.map(({ key }) => key),
                )
              }
              style={styles.selectAllRow}
            >
              <Ionicons
                name={allSelected ? 'close-circle-outline' : 'checkmark-done'}
                size={16}
                color="#fff"
              />
              <ThemedText type="small">
                {allSelected ? t('filter.unselectAll') : t('filter.selectAll')}
              </ThemedText>
            </Pressable>
            <ScrollView style={styles.optionList}>
              {row(selected.length === 0, 'all', t('filter.allCategories'), total)}
              {categories.map(({ key, name, count }) =>
                row(selected.includes(key), key, name, count),
              )}
            </ScrollView>
            {/* AND/OR switch — only meaningful once 2+ categories combine,
                and only for inclusion (exclusion always drops any match). */}
            {onMatchAllChange && !excluding && selected.length >= 2 && (
              <Pressable
                testID="category-filter-match-all"
                onPress={() => onMatchAllChange(!matchAll)}
                style={styles.matchAllRow}
              >
                <Ionicons
                  name={matchAll ? 'checkbox' : 'square-outline'}
                  size={18}
                  color="#fff"
                />
                <ThemedText type="small" style={styles.matchAllText}>
                  {t('filter.matchAll')}
                </ThemedText>
              </Pressable>
            )}
            <Pressable
              testID="category-filter-done"
              onPress={() => setOpen(false)}
              style={({ pressed }) => [
                styles.doneButton,
                { backgroundColor: RIGHT_COLOR, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <ThemedText type="subtitle" style={styles.doneText}>
                {t('filter.done')}
              </ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
    maxWidth: 280,
  },
  triggerText: {
    flexShrink: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  sheet: {
    width: '100%',
    maxWidth: 340,
    maxHeight: '70%',
    borderRadius: Spacing.three,
    backgroundColor: SHEET_BG,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  sheetTitle: {
    textAlign: 'center',
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  modeChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.four,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    alignSelf: 'flex-end',
  },
  optionList: {
    flexGrow: 0,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  matchAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  matchAllText: {
    flexShrink: 1,
  },
  doneButton: {
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  doneText: {
    color: '#fff',
  },
});
