// components/ui/FadeIn.tsx
// Entrance for sections: a short opacity fade, nothing else. Honors the system "reduce motion" setting.
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn as Fade, ReduceMotion } from 'react-native-reanimated';

interface FadeInProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const entering = Fade.duration(200).reduceMotion(ReduceMotion.System);

export const FadeIn: React.FC<FadeInProps> = ({ children, style }) => (
  <Animated.View entering={entering} style={style}>
    {children}
  </Animated.View>
);

export default FadeIn;
