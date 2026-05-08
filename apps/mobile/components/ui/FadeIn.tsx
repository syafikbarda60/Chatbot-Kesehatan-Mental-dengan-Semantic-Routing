// components/ui/FadeIn.tsx
// Wrapper that fades + slides in children on mount.

import React from 'react';
import { Animated } from 'react-native';
import { useAnimatedEntrance } from '../../hooks/useAnimatedEntrance';

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  fromY?: number;
  style?: object;
}

export const FadeIn: React.FC<FadeInProps> = ({
  children,
  delay = 0,
  duration = 350,
  fromY = 12,
  style,
}) => {
  const { opacity, translateY } = useAnimatedEntrance({ delay, duration, fromY });

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
};

export default FadeIn;
