import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Animated, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SanctuaryColors } from '../constants/theme';

interface Props {
  onAnimationComplete: () => void;
}

const SPLASH_LOGO = require('../assets/image.png');

export function AnimatedSplashScreen({ onAnimationComplete }: Props) {
  const containerOp = useRef(new Animated.Value(1)).current;
  const logoOp = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 1. Sembunyikan native splash screen secepatnya
    // karena kita sudah siap merender splash tiruan di atasnya.
    SplashScreen.hideAsync().then(() => setIsReady(true));
  }, []);

  useEffect(() => {
    if (isReady) {
      Animated.sequence([
        Animated.delay(100),
        // Phase 1: Logo memudar masuk dan sedikit membesar
        Animated.parallel([
          Animated.timing(logoOp, { toValue: 1, duration: 650, useNativeDriver: true }),
          Animated.spring(logoScale, { toValue: 1, friction: 14, tension: 40, useNativeDriver: true }),
        ]),
        Animated.delay(900),
        // Phase 2: Seluruh container memudar menghilang
        Animated.timing(containerOp, { toValue: 0, duration: 500, useNativeDriver: true })
      ]).start(() => {
        onAnimationComplete();
      });
    }
  }, [isReady]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.container, { opacity: containerOp }]}>
      <Animated.Image
        source={SPLASH_LOGO}
        style={[
          styles.logo,
          { opacity: logoOp, transform: [{ scale: logoScale }] }
        ]}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: SanctuaryColors.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  logo: {
    width: 160,
    height: 160,
  }
});
