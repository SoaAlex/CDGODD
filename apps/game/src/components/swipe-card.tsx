import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import type { DeckCard } from '@cdgodd/shared';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** French political colors: gauche = red, droite = blue. */
export const LEFT_COLOR = '#e63946';
export const RIGHT_COLOR = '#1d6fd8';

export function SwipeCard({ card }: { card: DeckCard }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      {card.imageUrl ? (
        <Image
          source={{ uri: card.imageUrl }}
          style={styles.image}
          contentFit="cover"
          transition={100}
        />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <ThemedText type="title" style={styles.placeholderEmoji}>
            🤔
          </ThemedText>
        </View>
      )}
      <View style={styles.labelZone}>
        <ThemedText type="subtitle" style={styles.label}>
          {card.label}
        </ThemedText>
        {card.categoryKey && (
          <ThemedText type="small" themeColor="textSecondary">
            {card.categoryKey}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: Spacing.four,
    overflow: 'hidden',
    // Subtle elevation (boxShadow works on native + web since RN 0.76).
    boxShadow: '0 6px 12px rgba(0, 0, 0, 0.15)',
    elevation: 6,
  },
  image: {
    flex: 1,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderEmoji: {
    fontSize: 96,
    lineHeight: 120,
  },
  labelZone: {
    padding: Spacing.four,
    gap: Spacing.one,
  },
  label: {
    textAlign: 'center',
  },
});
