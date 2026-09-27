import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '@prototype/ui-shared';
import { SajiwaColors } from '@prototype/ui-shared';
import { AnimatedSplashScreen } from '../components/AnimatedSplashScreen';
import { ToastProvider } from '../components/ui/Toast';

SplashScreen.preventAutoHideAsync();

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

  useEffect(() => {
    setUnauthorizedCallback(() => {
      router.replace('/');
    });
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <ToastProvider>
        <StatusBar style="dark" backgroundColor={SajiwaColors.background} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: SajiwaColors.background },
            animation: 'fade_from_bottom',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="register" />
          <Stack.Screen name="home" />
          <Stack.Screen name="admin" />
          <Stack.Screen name="chat" />
          <Stack.Screen name="journal" />
          <Stack.Screen name="stats" />
          <Stack.Screen name="profile" />
        </Stack>
        {!splashAnimationFinished && (
          <AnimatedSplashScreen onAnimationComplete={() => setSplashAnimationFinished(true)} />
        )}
        </ToastProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

