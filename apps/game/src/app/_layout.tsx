import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { DefaultTheme, router, ThemeProvider, usePathname } from 'expo-router';
import { Stack as NativeStack } from 'expo-router';
import JsStack from 'expo-router/js-stack';
import { useEffect } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { GameTitle } from '@/components/game-title';
import { GradientBackground } from '@/components/gradient-background';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useLangReady, useT } from '@/lib/i18n';
import { startBackgroundMusic } from '@/lib/music';

/**
 * The native stack has no transition animations on web, so use the
 * JavaScript stack there; native platforms keep their built-in transitions.
 */
const Stack =
  Platform.OS === 'web' ? (JsStack as unknown as typeof NativeStack) : NativeStack;

/** Shape of the JS stack's card interpolation props (not publicly exported). */
interface CardInterpolation {
  current: { progress: Animated.AnimatedInterpolation<number> };
  next?: { progress: Animated.AnimatedInterpolation<number> };
  inverted: Animated.AnimatedInterpolation<number>;
  layouts: { screen: { width: number; height: number } };
}

/**
 * Web transition: the leaving screen slides out to the left while fading,
 * the incoming one slides in from the right. Cards are transparent over one
 * shared gradient, so BOTH sides must fade — an incoming screen simply
 * drawn on top of a still-opaque one reads as a laggy double exposure.
 */
function forSlideFade({
  current,
  next,
  inverted,
  layouts: { screen },
}: CardInterpolation) {
  const travel = screen.width * 0.3;
  const translateFocused = Animated.multiply(
    current.progress.interpolate({
      inputRange: [0, 1],
      outputRange: [travel, 0],
      extrapolate: 'clamp',
    }),
    inverted,
  );
  const translateUnfocused = next
    ? Animated.multiply(
        next.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -travel],
          extrapolate: 'clamp',
        }),
        inverted,
      )
    : 0;
  const opacity = next
    ? Animated.multiply(
        current.progress,
        next.progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
      )
    : current.progress;

  return {
    cardStyle: {
      opacity,
      transform: [
        { translateX: translateFocused },
        { translateX: translateUnfocused },
      ],
    },
  };
}

/** Quick, decelerating push — the old screen darts off to the left. */
const SNAPPY_TRANSITION = {
  animation: 'timing' as const,
  config: { duration: 200, easing: Easing.out(Easing.cubic) },
};

/**
 * Web back arrow: the JS stack's built-in button vanishes when a deep link is
 * loaded fresh (no history to go back to), so always render one and fall back
 * to the home screen when there is nothing to pop.
 */
function HeaderBack() {
  const { t } = useT();
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={t('menu.back')}
      style={({ pressed }) => ({
        paddingHorizontal: Spacing.four,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name="arrow-back" size={24} color="#fff" />
    </Pressable>
  );
}

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
  const pathname = usePathname();
  // Screen titles render through t(); hold first paint until the stored
  // language is read so the default French doesn't flash for players on
  // another language.
  const { t } = useT();
  const langReady = useLangReady();
  const { width } = useWindowDimensions();
  // Screens center their content in a MaxContentWidth column; inset the
  // header's back arrow by the same margin so it lines up with that column
  // instead of hugging the viewport edge on wide screens.
  const headerSideInset = Math.max(0, (width - MaxContentWidth) / 2);

  useEffect(() => {
    startBackgroundMusic(); // no-op on native
  }, []);

  // Web: react-navigation puts aria-hidden on the outgoing screen while the
  // link/button that triggered the navigation still holds focus, which the
  // browser flags ("Blocked aria-hidden on an element because its descendant
  // retained focus"). Drop focus as soon as the route changes.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = document.activeElement;
    if (el instanceof HTMLElement) el.blur();
  }, [pathname]);

  if (!fontsLoaded || !langReady) return null;

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
              // Every screen except home shows the game wordmark; each
              // screen's `title` still names the browser tab on web.
              headerTitle: () => <GameTitle />,
              headerTitleAlign: 'center',
              // Web-only (see Stack above). `animation` just switches the JS
              // stack's animation on; forSlideFade defines the actual motion.
              // The overlay stays off: cards are transparent, so the preset's
              // dim overlay would permanently darken the gradient.
              ...(Platform.OS === 'web'
                ? {
                    animation: 'fade' as const,
                    cardOverlayEnabled: false,
                    // The JS stack's default web behavior sizes cards by their
                    // content (minHeight: 100%) and expects document.body to
                    // scroll the page — but the HTML shell locks body scrolling
                    // (ScrollViewStyleReset + 100dvh), so tall screens (history,
                    // multiplayer results) just clipped. flex: 1 clamps cards to
                    // the viewport so inner FlatLists scroll instead.
                    cardStyle: { flex: 1 },
                    cardStyleInterpolator: forSlideFade,
                    transitionSpec: {
                      open: SNAPPY_TRANSITION,
                      close: SNAPPY_TRANSITION,
                    },
                    headerLeft: () => <HeaderBack />,
                    headerLeftContainerStyle: { paddingLeft: headerSideInset },
                    // Mirror the inset on the right so the centered title
                    // isn't pushed sideways by the wide left container.
                    headerRightContainerStyle: { paddingRight: headerSideInset },
                  }
                : null),
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
          <Stack.Screen
            name="credits"
            options={{
              title: t('menu.credits'),
              headerBackButtonDisplayMode: 'minimal',
            }}
          />
          </Stack>
        </ThemeProvider>
      </GradientBackground>
    </GestureHandlerRootView>
  );
}
