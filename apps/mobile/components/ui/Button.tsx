// components/ui/Button.tsx
// Reusable button with variants: 'primary' | 'secondary' | 'ghost' | 'danger'

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { Typography, Spacing, BorderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

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
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  textStyle,
  icon,
}) => {
  const { colors } = useTheme();

  const getContainerStyle = (): ViewStyle => {
    switch (variant) {
      case 'primary':   return { backgroundColor: colors.primary };
      case 'secondary': return { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border };
      case 'ghost':     return { backgroundColor: 'transparent' };
      case 'danger':    return { backgroundColor: colors.stressHigh };
      default:          return {};
    }
  };

  const getLabelColor = () => {
    switch (variant) {
      case 'primary':   return '#FFFFFF';
      case 'secondary': return colors.textSecondary;
      case 'ghost':     return colors.textSecondary;
      case 'danger':    return '#FFFFFF';
      default:          return colors.textPrimary;
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.base, getContainerStyle(), (disabled || loading) && styles.disabled, style]}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={getLabelColor()} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.label, { color: getLabelColor() }, textStyle]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.base + 2,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  disabled: { opacity: 0.45 },
  label:    { fontSize: Typography.base, fontFamily: 'PlusJakartaSans_700Bold' },
});

export default Button;
