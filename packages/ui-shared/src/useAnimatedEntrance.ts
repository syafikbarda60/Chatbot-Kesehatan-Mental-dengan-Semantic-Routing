// hooks/useAnimatedEntrance.ts
// Reusable hook for a standard fade + translateY entrance animation.

import { useRef, useEffect } from 'react';
import { Animated } from 'react-native';

interface Options {
  delay?: number;
  duration?: number;
  fromY?: number;
}

export function useAnimatedEntrance({ delay = 0, duration = 350, fromY = 12 }: Options = {}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(fromY)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity,     { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(translateY,  { toValue: 0, duration, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, []);

  return { opacity, translateY };
}
