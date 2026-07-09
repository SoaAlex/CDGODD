import { Image } from 'expo-image';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
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
  const [showCredit, setShowCredit] = useState(false);
  const attribution = card.imageUrl ? card.imageAttribution : null;
  const isAi = attribution?.license === 'ai-generated';

  return (
    <View style={styles.card}>
      {card.imageUrl ? (
        <View style={styles.imageWrap}>
          <Image
            source={{ uri: card.imageUrl }}
            style={styles.image}
            contentFit="cover"
            transition={100}
          />
          {isAi && (
            <View
              style={styles.creditBadge}
              accessibilityLabel={t('game.aiGenerated')}
            >
              <ThemedText type="small" style={styles.creditBadgeText}>
                IA
              </ThemedText>
            </View>
          )}
          {attribution && !isAi && (
            <>
              {/* Small target on purpose: a tap here must not eat swipes. */}
              <Pressable
                onPress={() => setShowCredit((v) => !v)}
                hitSlop={8}
                style={styles.creditBadge}
                accessibilityLabel={t('game.imageCredit')}
              >
                <ThemedText type="small" style={styles.creditBadgeText}>
                  ⓘ
                </ThemedText>
              </Pressable>
              {showCredit && (
                <Pressable
                  onPress={() => {
                    if (attribution.sourceUrl) {
                      void Linking.openURL(attribution.sourceUrl);
                    }
                  }}
                  style={styles.creditStrip}
                >
                  <ThemedText
                    type="small"
                    style={styles.creditStripText}
                    numberOfLines={1}
                  >
                    © {attribution.author ?? '—'} · {attribution.license}
                  </ThemedText>
                </Pressable>
              )}
            </>
          )}
        </View>
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
        {card.categoryKeys.length > 0 && (
          <ThemedText type="small" style={{ color: CARD_TEXT_SECONDARY }}>
            {card.categoryKeys.map(categoryName).join(' · ')}
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
  imageWrap: {
    flex: 1,
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
  creditBadge: {
    position: 'absolute',
    bottom: Spacing.two,
    right: Spacing.two,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  creditBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    lineHeight: 16,
  },
  creditStrip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  creditStripText: {
    color: '#ffffff',
    textAlign: 'center',
  },
  labelZone: {
    padding: Spacing.four,
    gap: Spacing.one,
  },
  label: {
    textAlign: 'center',
  },
});
