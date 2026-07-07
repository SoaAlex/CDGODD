import { useFonts } from 'expo-font';
import { DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { GradientBackground } from '@/components/gradient-background';
import { t } from '@/lib/i18n';
import { startBackgroundMusic } from '@/lib/music';

/** Navigation theme that lets the gradient show through and keeps chrome white. */
const NavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: 'transparent',
    card: 'transparent',
    text: '#ffffff',
    border: 'transparent',
  },
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    // Single ClashGrotesk variable family everywhere, matching the web app.
    'ClashGrotesk-Variable': require('../../assets/fonts/ClashGrotesk-Variable.ttf'),
  });

  useEffect(() => {
    startBackgroundMusic(); // no-op on native
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GradientBackground>
        <ThemeProvider value={NavTheme}>
          <Stack
            screenOptions={{
              contentStyle: { backgroundColor: 'transparent' },
              headerStyle: { backgroundColor: 'transparent' },
              headerShadowVisible: false,
              headerTintColor: '#fff',
              headerTitleStyle: { color: '#fff' },
            }}
          >
            <Stack.Screen
              name="index"
              options={{ headerShown: false, title: t('menu.title') }}
            />
          <Stack.Screen
            name="solo"
            options={{ title: t('menu.play'), headerBackButtonDisplayMode: 'minimal' }}
          />
          <Stack.Screen
            name="search"
            options={{
              title: t('solo.search'),
              headerBackButtonDisplayMode: 'minimal',
            }}
          />
          <Stack.Screen
            name="multiplayer"
            options={{
              title: t('menu.multiplayer'),
              headerBackButtonDisplayMode: 'minimal',
            }}
          />
          <Stack.Screen
            name="room/[code]"
            options={{
              title: t('menu.multiplayer'),
              headerBackButtonDisplayMode: 'minimal',
            }}
          />
          <Stack.Screen
            name="history"
            options={{
              title: t('menu.history'),
              headerBackButtonDisplayMode: 'minimal',
            }}
          />
          <Stack.Screen
            name="settings"
            options={{
              title: t('menu.settings'),
              headerBackButtonDisplayMode: 'minimal',
            }}
          />
          </Stack>
        </ThemeProvider>
      </GradientBackground>
    </GestureHandlerRootView>
  );
}
