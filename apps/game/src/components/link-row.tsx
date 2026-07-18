import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Tappable row opening an external URL (or mailto:). Shared by the
 * credits and privacy screens. */
export function LinkRow({
  icon,
  label,
  url,
  testID,
}: Readonly<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  url: string;
  testID?: string;
}>) {
  const theme = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={() => void Linking.openURL(url)}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.backgroundElement,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.rowContent}>
        <Ionicons name={icon} size={18} color={theme.text} />
        <ThemedText type="small" style={styles.rowLabel}>
          {label}
        </ThemedText>
        <Ionicons name="open-outline" size={16} color={theme.textSecondary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowLabel: {
    flex: 1,
  },
});
