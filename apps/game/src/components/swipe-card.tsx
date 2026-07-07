import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import type { DeckCard } from '@cdgodd/shared';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { categoryName, t } from '@/lib/i18n';

/** French political colors: gauche = red, droite = blue (from the web app). */
export const LEFT_COLOR = '#e2523a';
export const RIGHT_COLOR = '#6db0f8';

/** Solid card colors — the card is an opaque white surface on the gradient. */
const CARD_TEXT = '#1b1b2f';
const CARD_TEXT_SECONDARY = 'rgba(27, 27, 47, 0.55)';

export function SwipeCard({ card }: { card: DeckCard }) {
  return (
    <View style={styles.card}>
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
          <ThemedText type="small" style={{ color: CARD_TEXT_SECONDARY }}>
            {t('game.imageComingSoon')}
          </ThemedText>
        </View>
      )}
      <View style={styles.labelZone}>
        <ThemedText type="subtitle" style={[styles.label, { color: CARD_TEXT }]}>
          {card.label}
        </ThemedText>
        {card.categoryKey && (
          <ThemedText type="small" style={{ color: CARD_TEXT_SECONDARY }}>
            {categoryName(card.categoryKey)}
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
    backgroundColor: '#ffffff',
    // Subtle elevation (boxShadow works on native + web since RN 0.76).
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
    elevation: 6,
  },
  image: {
    flex: 1,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef0f6',
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
