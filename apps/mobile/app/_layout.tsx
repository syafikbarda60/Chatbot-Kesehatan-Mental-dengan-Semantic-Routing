import { Stack, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { setUnauthorizedCallback } from '@prototype/api-client';
import { useFonts } from 'expo-font';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_700Bold_Italic,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

import * as SplashScreen from 'expo-splash-screen';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useAuth } from '@prototype/ui-shared';
import { SajiwaColors } from '@prototype/ui-shared';
import { AnimatedSplashScreen } from '../components/AnimatedSplashScreen';
import { ToastProvider } from '../components/ui/Toast';
import { ConsentSheet } from '../components/ui/ConsentSheet';
import { isSwipeTab, swipeTab, tabAnimation } from '../components/ui/BottomNav';
import { useCheckIn } from '../hooks/useCheckIn';
import { useInbox } from '../hooks/useInbox';

SplashScreen.preventAutoHideAsync();

// Bottom-nav tabs never swipe back. A tap switches instantly, the way a native tab bar does;
// a sideways swipe slides the next tab in from the side it came from.
const TAB = () => ({ animation: tabAnimation(), gestureEnabled: false } as const);
// Auth screens replace each other rather than stacking, so they cross-fade
const AUTH = { animation: 'fade', gestureEnabled: false } as const;

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_700Bold_Italic,
    PlusJakartaSans_800ExtraBold,
  });

  const [splashAnimationFinished, setSplashAnimationFinished] = useState(false);
  // Daily check-in notification; a tap waits for the splash, by which time sign-in has redirected
  useCheckIn(fontsLoaded && splashAnimationFinished);
  // Counseling news from the server, and reminders before each session
  useInbox(fontsLoaded && splashAnimationFinished);

  // Swipe sideways on a tab screen to reach the neighbouring tab. It waits for a clearly
  // horizontal drag (40pt), longer than the calendar's month swipe (24pt) and a scroll
  // view's own slop, so anything inside that pages sideways claims the drag first.
  const pathname = usePathname();
  const tabSwipe = useMemo(
    () =>
      Gesture.Pan()
        .enabled(isSwipeTab(pathname))
        .activeOffsetX([-40, 40])
        .failOffsetY([-16, 16])
        .runOnJS(true)
        .onEnd((e) => {
          // A long drag, or a short flick still moving the same way
          const flick = Math.abs(e.velocityX) > 500 && Math.sign(e.velocityX) === Math.sign(e.translationX);
          if (Math.abs(e.translationX) < 80 && !flick) return;
          swipeTab(pathname, e.translationX < 0 ? 'next' : 'prev');
        }),
    [pathname],
  );

  // A rejected session (expired, revoked, or its account gone) signs out everywhere, not
  // just in storage: screens still holding the old user — the privacy sheet above all — would
  // keep calling the API with it and report every 401 as a connection problem.
  const { logout } = useAuth();
  useEffect(() => {
    setUnauthorizedCallback(() => {
      logout().catch(() => {});
      router.replace('/');
    });
  }, [logout]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <ToastProvider>
        <StatusBar style="dark" />
        <GestureDetector gesture={tabSwipe}>
        <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: SajiwaColors.background },
            // Native stack: the push runs on the platform compositor, so it keeps
            // 60fps even while JS is busy. 'ios_from_right' gives Android the iOS push (the
            // screen underneath drifts left instead of sitting still) and resolves to the
            // native push on iOS itself.
            animation: 'ios_from_right',
            gestureEnabled: true,
            gestureDirection: 'horizontal',
            // Swipe back from anywhere on the screen, not just the 20pt left edge — how
            // iOS apps with a custom bar (no navigation bar) usually feel. Catch: a rightward
            // swipe anywhere now means "back", so a pushed screen that pages content
            // sideways (carousel, calendar, horizontal list) must set it false for itself.
            // Today those all live on TAB screens, where swipe-back is off anyway.
            fullScreenGestureEnabled: true,
          }}
        >
          <Stack.Screen name="index" options={AUTH} />
          <Stack.Screen name="register" options={AUTH} />
          <Stack.Screen name="home" options={TAB} />
          <Stack.Screen name="admin" options={AUTH} />
          <Stack.Screen name="chat" options={TAB} />
          <Stack.Screen name="journal" />
          <Stack.Screen name="assessment" options={TAB} />
          <Stack.Screen name="stats" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="profile" options={TAB} />
          <Stack.Screen name="schedule" options={TAB} />
          <Stack.Screen name="journal-history" options={TAB} />
        </Stack>
        </View>
        </GestureDetector>
        {/* Privacy consent, once per account, above every screen */}
        <ConsentSheet />
        {!splashAnimationFinished && (
          <AnimatedSplashScreen onAnimationComplete={() => setSplashAnimationFinished(true)} />
        )}
        </ToastProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

