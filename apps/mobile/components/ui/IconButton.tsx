import React, { useState } from 'react';
import Animated from 'react-native-reanimated';
import { usePressScale } from './usePressScale';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Neu } from '@prototype/ui-shared';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  label: string; // spoken by screen readers
  onPress: () => void;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// 44px round neumorphic button; sinks in and springs back when pressed.
export const IconButton: React.FC<Props> = ({ icon, label, onPress, color, size = 44, style, disabled }) => {
  const { colors } = useTheme();
  const [pressed, setPressed] = useState(false);
  const press = usePressScale(0.95);
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => { setPressed(true); press.onPressIn(); }}
      onPressOut={() => { setPressed(false); press.onPressOut(); }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={[
        {
          width: size, height: size, borderRadius: size / 2,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: colors.background,
          boxShadow: pressed ? Neu.inset : Neu.raisedSm,
        },
        disabled && { opacity: 0.4 },
        style,
        press.style,
      ]}
    >
      <Ionicons name={icon} size={20} color={color ?? colors.onSurface} />
    </AnimatedPressable>
  );
};

export default IconButton;
