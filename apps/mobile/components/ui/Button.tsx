// components/ui/Button.tsx
// Reusable button with variants: 'primary' | 'secondary' | 'ghost' | 'danger'

import React, { useState } from 'react';
import Animated from 'react-native-reanimated';
import { usePressScale } from './usePressScale';
import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { Typography, Spacing, BorderRadius, Neu } from '@prototype/ui-shared';
import { useTheme } from '@prototype/ui-shared';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  /** Feature color for the primary variant (e.g. sage on journal screens, amber on counseling). */
  accent?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  textStyle,
  icon,
  accent,
}) => {
  const { colors } = useTheme();
  const [pressed, setPressed] = useState(false);
  const press = usePressScale(0.98);

  const getContainerStyle = (): ViewStyle => {
    switch (variant) {
      case 'primary':   return { backgroundColor: accent ?? colors.primary, boxShadow: Neu.raised };
      case 'secondary': return { backgroundColor: colors.background, boxShadow: Neu.raised };
      case 'ghost':     return {};
      case 'danger':    return { backgroundColor: colors.stressHigh };
      default:          return {};
    }
  };

  const getLabelColor = () => {
    switch (variant) {
      case 'primary':   return '#FFFFFF';
      case 'secondary': return colors.primary;
      case 'ghost':     return colors.textSecondary;
      case 'danger':    return '#FFFFFF';
      default:          return colors.textPrimary;
    }
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => { setPressed(true); press.onPressIn(); }}
      onPressOut={() => { setPressed(false); press.onPressOut(); }}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={[
        styles.base,
        getContainerStyle(),
        // Neumorphic press: the surface sinks in and springs back
        pressed && variant !== 'ghost' && { boxShadow: Neu.inset },
        (disabled || loading) && styles.disabled,
        style,
        press.style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getLabelColor()} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.label, { color: getLabelColor() }, textStyle]}>{label}</Text>
        </>
      )}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.xl,
    minHeight: 52,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  disabled: { opacity: 0.45 },
  label:    { fontSize: Typography.base, fontFamily: 'PlusJakartaSans_700Bold' },
});

export default Button;

