import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { t } from '@/lib/i18n';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
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
    </GestureHandlerRootView>
  );
}
