import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';

import { AuroraBlobs } from '@/components/aurora-blobs';
import { Gradient } from '@/constants/theme';

/** Full-bleed purple brand gradient used as the app background on every screen. */
export function GradientBackground({
  children,
  style,
}: {
  children?: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <LinearGradient colors={Gradient} style={[styles.fill, style]}>
      <AuroraBlobs />
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
