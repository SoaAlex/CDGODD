import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { RIGHT_COLOR } from '@/components/swipe-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/lib/i18n';

/** Opaque card color for the picker (blend of the brand gradient). */
const SHEET_BG = '#565393';

/**
 * Category filter as a dropdown: a compact trigger showing the current
 * selection opens a modal multi-select list (scales to many categories).
 * An empty selection means "all categories". Renders nothing until the
 * category list loads.
 */
export function CategoryFilter({
  selected,
  onChange,
  centered = false,
}: {
  selected: string[];
  onChange: (keys: string[]) => void;
  /** Center the trigger (solo header); default left-aligns (settings forms). */
  centered?: boolean;
}) {
  const categories = useCategories();
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
  const selectedNames = categories
    .filter(({ key }) => selected.includes(key))
    .map(({ name }) => name);
  const label =
    selectedNames.length === 0
      ? t('filter.allCategories')
      : selectedNames.length <= 2
        ? selectedNames.join(' · ')
        : `${selectedNames.length} ${t('filter.categoriesLabel').toLowerCase()}`;

  const row = (isSelected: boolean, key: string, name: string) => (
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
      <ThemedText>{name}</ThemedText>
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
              selected.length > 0 ? RIGHT_COLOR : theme.backgroundElement,
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
            <ScrollView style={styles.optionList}>
              {row(selected.length === 0, 'all', t('filter.allCategories'))}
              {categories.map(({ key, name }) =>
                row(selected.includes(key), key, name),
              )}
            </ScrollView>
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
  doneButton: {
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  doneText: {
    color: '#fff',
  },
});
