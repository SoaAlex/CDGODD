import { StyleSheet, View } from 'react-native';
import type { VoteTally } from '@cdgodd/shared';
import { ThemedText } from '@/components/themed-text';
import {
  LEFT_COLOR,
  RIGHT_COLOR,
  Spacing,
  TEXT_SHADOW,
} from '@/constants/theme';

/** Community result of the last card voted on: proportional gauche/droite bar. */
export function TallyBar({ tally }: { tally: VoteTally }) {
  const total = tally.votesLeft + tally.votesRight;
  if (total === 0) return null;
  const leftPct = Math.round((tally.votesLeft / total) * 100);
  const rightPct = 100 - leftPct;

  return (
    <View style={styles.container}>
      <View style={styles.bar}>
        <View
          style={[styles.segment, { flex: leftPct, backgroundColor: LEFT_COLOR }]}
        />
        <View
          style={[styles.segment, { flex: rightPct, backgroundColor: RIGHT_COLOR }]}
        />
      </View>
      <View style={styles.labels}>
        <ThemedText type="smallBold" style={[styles.pct, { color: LEFT_COLOR }]}>
          {leftPct}%
        </ThemedText>
        <ThemedText
          type="smallBold"
          style={[styles.pct, { color: RIGHT_COLOR }]}
        >
          {rightPct}%
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  bar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  segment: {
    minWidth: 4,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pct: {
    fontSize: 20,
    lineHeight: 26,
    ...TEXT_SHADOW,
  },
});
