import { Pressable, StyleSheet, View } from 'react-native';
import { RIGHT_COLOR } from '@/components/swipe-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/lib/i18n';

/**
 * Multi-select category chips. An empty selection means "all categories"
 * (the dedicated "Toutes" chip). Renders nothing until the list loads.
 */
export function CategoryFilter({
  selected,
  onChange,
  centered = false,
}: {
  selected: string[];
  onChange: (keys: string[]) => void;
  /** Center the chips (solo header); default left-aligns (settings forms). */
  centered?: boolean;
}) {
  const categories = useCategories();
  const theme = useTheme();
  if (categories.length === 0) return null;

  const chip = (isSelected: boolean) => ({
    backgroundColor: isSelected ? RIGHT_COLOR : theme.backgroundElement,
  });
  const chipText = (isSelected: boolean) =>
    isSelected ? { color: '#fff' } : null;

  function toggle(key: string) {
    onChange(
      selected.includes(key)
        ? selected.filter((k) => k !== key)
        : [...selected, key],
    );
  }

  return (
    <View style={[styles.chipRow, centered && styles.centered]}>
      <Pressable
        testID="category-all"
        onPress={() => onChange([])}
        style={[styles.chip, chip(selected.length === 0)]}
      >
        <ThemedText type="small" style={chipText(selected.length === 0)}>
          {t('filter.allCategories')}
        </ThemedText>
      </Pressable>
      {categories.map(({ key, name }) => (
        <Pressable
          key={key}
          testID={`category-${key}`}
          onPress={() => toggle(key)}
          style={[styles.chip, chip(selected.includes(key))]}
        >
          <ThemedText type="small" style={chipText(selected.includes(key))}>
            {name}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  centered: {
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
  },
});
