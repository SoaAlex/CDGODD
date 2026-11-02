import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'pageTitle' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
  /** Outline level: renders <h1>-<h3> on web, a screen reader header on native. */
  heading?: 1 | 2 | 3;
};

export function ThemedText({ style, type = 'default', themeColor, heading, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const headingProps = heading ? { role: 'heading' as const, 'aria-level': heading } : undefined;

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'pageTitle' && styles.pageTitle,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...headingProps}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
  },
  smallBold: {
    fontFamily: Fonts.sansMedium,
    fontWeight: '600',
    fontSize: 15,
    lineHeight: 22,
  },
  default: {
    fontFamily: Fonts.sans,
    fontSize: 17,
    lineHeight: 26,
  },
  title: {
    fontFamily: Fonts.display,
    fontWeight: '700',
    fontSize: 52,
    lineHeight: 60,
  },
  // Screen name on text pages: long French names must fit a phone width.
  pageTitle: {
    fontFamily: Fonts.display,
    fontWeight: '700',
    fontSize: 36,
    lineHeight: 44,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: Fonts.sansMedium,
    fontWeight: '600',
    fontSize: 34,
    lineHeight: 46,
  },
  link: {
    fontFamily: Fonts.sans,
    lineHeight: 32,
    fontSize: 15,
  },
  linkPrimary: {
    fontFamily: Fonts.sans,
    lineHeight: 32,
    fontSize: 15,
    color: '#3c87f7',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 13,
  },
});
