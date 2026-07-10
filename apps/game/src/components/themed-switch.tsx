import { Switch } from 'react-native';
import type { ComponentProps } from 'react';
import { ACCENT_COLOR } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// react-native-web colors the on-state thumb via activeThumbColor, a prop
// missing from the core RN Switch types.
const webThumb = { activeThumbColor: '#ffffff' } as Partial<
  ComponentProps<typeof Switch>
>;

/**
 * Switch wired to the app palette: purple accent track when on, frosted glass
 * track when off. Replaces the platform default (green on iOS/web) which
 * clashed with the gradient look.
 */
export function ThemedSwitch(props: ComponentProps<typeof Switch>) {
  const theme = useTheme();
  return (
    <Switch
      trackColor={{ false: theme.backgroundSelected, true: ACCENT_COLOR }}
      thumbColor="#ffffff"
      ios_backgroundColor={theme.backgroundSelected}
      {...webThumb}
      {...props}
    />
  );
}
