import { StyleSheet, Text } from 'react-native';

import {
  Fonts,
  LEFT_COLOR,
  RIGHT_COLOR,
  TEXT_SHADOW,
} from '@/constants/theme';

/**
 * Horizontal wordmark used as the header title on every screen except home.
 * Mirrors the home logo: white connectors, red GAUCHE, blue DROITE.
 */
export function GameTitle() {
  return (
    <Text style={styles.title} numberOfLines={1} allowFontScaling={false}>
      <Text style={styles.white}>C’EST DE </Text>
      <Text style={styles.gauche}>GAUCHE</Text>
      <Text style={styles.white}> OU DE </Text>
      <Text style={styles.droite}>DROITE</Text>
      <Text style={styles.white}> ?</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: Fonts.display,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
    ...TEXT_SHADOW,
  },
  white: {
    color: '#ffffff',
  },
  gauche: {
    color: LEFT_COLOR,
  },
  droite: {
    color: RIGHT_COLOR,
  },
});
