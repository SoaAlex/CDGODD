import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { TallyBar } from '@/components/tally-bar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { LastVote } from '@/hooks/use-deck';

/**
 * Result of the PREVIOUS card: tiny thumbnail, name, and the global
 * tally. Rendered only when the "show results" preference is on.
 */
export function LastVoteBar({ lastVote }: { lastVote: LastVote }) {
  const theme = useTheme();
  const { card, tally } = lastVote;
  if (!tally) return null;

  return (
    <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      {card.imageUrl ? (
        <Image source={{ uri: card.imageUrl }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <ThemedText type="small">🤔</ThemedText>
        </View>
      )}
      <View style={styles.body}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {card.label}
        </ThemedText>
        <TallyBar tally={tally} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Spacing.two,
    padding: Spacing.two,
  },
  thumb: {
    width: 36,
    height: 36,
    borderRadius: Spacing.one,
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: Spacing.half,
  },
});
