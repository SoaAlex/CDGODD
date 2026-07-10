import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { TallyBar } from '@/components/tally-bar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';
import type { LastVote } from '@/hooks/use-deck';

/**
 * Result of the PREVIOUS card: titled white panel with a tiny thumbnail,
 * name, and the global tally. Always shown once you've voted.
 */
export function LastVoteBar({ lastVote }: { lastVote: LastVote }) {
  const { t } = useT();
  const theme = useTheme();
  const { card, tally } = lastVote;

  return (
    <View style={[styles.panel, { backgroundColor: theme.surface }]}>
      <ThemedText type="small" themeColor="textSecondaryOnSurface">
        {t('game.lastVoteResults')}
      </ThemedText>
      <View style={styles.row}>
        {card.imageUrl ? (
          <Image source={{ uri: card.imageUrl }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            <ThemedText type="small">🤔</ThemedText>
          </View>
        )}
        <View style={styles.body}>
          <ThemedText type="smallBold" themeColor="textOnSurface" numberOfLines={1}>
            {card.label}
          </ThemedText>
          <TallyBar tally={tally} compact />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: Spacing.one,
    borderRadius: Spacing.two,
    padding: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  thumb: {
    width: 36,
    height: 36,
    borderRadius: Spacing.one,
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef0f6',
  },
  body: {
    flex: 1,
    gap: Spacing.half,
  },
});
