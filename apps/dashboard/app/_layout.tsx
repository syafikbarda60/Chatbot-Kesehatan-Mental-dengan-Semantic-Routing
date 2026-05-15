import { Slot, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

/**
 * Root layout — handles auth gate.
 * If token exists in localStorage → show dashboard.
 * If not → show login (index).
 * This prevents the "flash login on refresh" problem.
 */
export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const segments = useSegments();

  // Check auth on mount (synchronous localStorage read — fast)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('sanctuary_token');
      const userRaw = localStorage.getItem('sanctuary_user');
      if (token && userRaw) {
        try {
          const user = JSON.parse(userRaw);
          if (['admin', 'pemangku_jabatan', 'konselor'].includes(user.role)) {
            setIsLoggedIn(true);
          }
        } catch {}
      }
    }
    setIsReady(true);
  }, []);

  // Route protection: redirect based on auth state
  useEffect(() => {
    if (!isReady) return;

    const inDashboard = segments[0] === '(dashboard)';

    if (isLoggedIn && !inDashboard) {
      // Logged in but on login page → go to dashboard
      router.replace('/(dashboard)');
    } else if (!isLoggedIn && inDashboard) {
      // Not logged in but on dashboard → go to login
      router.replace('/');
    }
  }, [isReady, isLoggedIn, segments]);

  // Show loading while checking auth
  if (!isReady) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#496175" />
      </View>
    );
  }

  return (
    <>
      <Slot />
      <StatusBar style="auto" />
    </>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
});
