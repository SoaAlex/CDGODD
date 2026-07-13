import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';

/**
 * Small "BETA" pill shown next to the game title. Hovering it (web) or tapping
 * it (native) reveals a tooltip explaining the game is still in development and
 * pointing players at the support email from the credits screen.
 */
export function BetaBadge() {
  const { t } = useT();
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('menu.beta')}
        accessibilityHint={t('menu.betaTooltip')}
        onHoverIn={() => setVisible(true)}
        onHoverOut={() => setVisible(false)}
        onPress={() => setVisible((v) => !v)}
        style={styles.badge}
      >
        <ThemedText type="smallBold" style={styles.badgeText}>
          {t('menu.beta')}
        </ThemedText>
      </Pressable>
      {visible && (
        <View style={styles.tooltip} pointerEvents="none">
          <ThemedText type="small" style={styles.tooltipText}>
            {t('menu.betaTooltip')}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    // Anchored beside the last line of the title, clear of the now-playing /
    // mute controls that sit in the top-right corner.
    position: 'absolute',
    bottom: Spacing.two,
    left: '100%',
    marginLeft: Spacing.two,
    alignItems: 'flex-start',
    zIndex: 2,
  },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.one,
    backgroundColor: '#f0a500',
  },
  badgeText: {
    color: '#1b1b2f',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1,
  },
  tooltip: {
    position: 'absolute',
    top: Spacing.five,
    right: 0,
    width: 260,
    maxWidth: 260,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    // Lifts the tooltip above the menu on web/native.
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  tooltipText: {
    color: '#ffffff',
  },
});
