// Drop-in replacement for Pressable that adds a subtle press (slight shrink on press-in).
// Accepts the same `style` / `children` shapes as Pressable, including ({ pressed }) => ... functions.
import React, { useState } from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressScale } from './usePressScale';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type State = { pressed: boolean };
interface Props extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle> | ((s: State) => StyleProp<ViewStyle>);
  children?: React.ReactNode | ((s: State) => React.ReactNode);
  scaleTo?: number;
}

export const PressableScale: React.FC<Props> = ({ style, children, scaleTo = 0.98, onPressIn, onPressOut, ...rest }) => {
  const [pressed, setPressed] = useState(false);
  const press = usePressScale(scaleTo);
  const resolved = typeof style === 'function' ? style({ pressed }) : style;
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => { setPressed(true); press.onPressIn(); onPressIn?.(e); }}
      onPressOut={(e) => { setPressed(false); press.onPressOut(); onPressOut?.(e); }}
      style={[resolved, press.style]}
    >
      {typeof children === 'function' ? children({ pressed }) : children}
    </AnimatedPressable>
  );
};

export default PressableScale;
