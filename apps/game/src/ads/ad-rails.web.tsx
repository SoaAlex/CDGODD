import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { AdSlot } from './ad-slot';

const RAIL_WIDTH = 160;
/** Rails only when the content column plus both rails fit comfortably. */
const MIN_WIDTH = MaxContentWidth + 2 * (RAIL_WIDTH + 2 * Spacing.four);

/**
 * Web: flanks the centered content column with two vertical ad rails on
 * wide viewports. Rendered as equal fixed-width flex siblings inside the
 * screens' `flexDirection: 'row', justifyContent: 'center'` container, so
 * the column stays perfectly centered and narrow viewports are untouched.
 */
export function AdRails({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const show = width >= MIN_WIDTH;
  return (
    <>
      {show && (
        <View style={styles.rail}>
          <AdSlot placement="side" />
        </View>
      )}
      {children}
      {show && (
        <View style={styles.rail}>
          <AdSlot placement="side" />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: RAIL_WIDTH,
    justifyContent: 'center',
    marginHorizontal: Spacing.four,
  },
});
