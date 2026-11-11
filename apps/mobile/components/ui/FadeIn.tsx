// components/ui/FadeIn.tsx
// Entrance for sections. On the phone the content settles up into place on a critically
// damped spring (no overshoot, so it reads smooth rather than bouncy). On react-native-web
// Reanimated's layout-animation path mispositions elements, so there it is a plain fade.
// Runs on the UI thread, and honors the system "reduce motion" setting.
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { arrive } from './motion';

const entering = arrive(FadeInDown);

interface FadeInProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const FadeIn: React.FC<FadeInProps> = ({ children, style }) => (
  <Animated.View entering={entering} style={style}>
    {children}
  </Animated.View>
);

export default FadeIn;
