// components/ui/Input.tsx
// shadcn-style Input primitive for React Native
// Elegant, accessible input field with focus state and icon slots

import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TextStyle,
  Pressable,
} from 'react-native';
import { NeuView } from './NeuView';
import { Typography, Spacing, BorderRadius } from '@prototype/ui-shared';
import { useTheme } from '@prototype/ui-shared';

export interface InputProps extends TextInputProps {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle | ViewStyle[];
  inputStyle?: TextStyle | TextStyle[];
}

export const Input: React.FC<InputProps> = ({
  label,
  helperText,
  error,
  leftIcon,
  rightIcon,
  containerStyle,
  inputStyle,
  onFocus,
  onBlur,
  ...props
}) => {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  const borderColor = error
    ? colors.stressHigh
    : isFocused
    ? colors.primary
    : 'transparent';

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: colors.onSurface }]}>
          {label}
        </Text>
      )}

      <NeuView inset radius={16} style={[styles.inputContainer, { borderColor }]}>
        {leftIcon && <View style={styles.leftSlot}>{leftIcon}</View>}

        <TextInput
          style={[
            styles.input,
            {
              color: colors.onSurface,
            },
            inputStyle,
          ]}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={props.accessibilityLabel ?? label ?? props.placeholder}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />

        {rightIcon && <View style={styles.rightSlot}>{rightIcon}</View>}
      </NeuView>

      {error ? (
        <Text style={[styles.errorText, { color: colors.stressHigh }]}>
          {error}
        </Text>
      ) : helperText ? (
        <Text style={[styles.helperText, { color: colors.onSurfaceVariant }]}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: Spacing.xs,
    gap: 6,
  },
  label: {
    fontSize: Typography.xs + 1,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    letterSpacing: 0.2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.md,
  },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: Typography.base,
    padding: 0,
    margin: 0,
  },
  leftSlot: {
    marginRight: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightSlot: {
    marginLeft: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  helperText: {
    fontSize: Typography.xs,
    fontFamily: 'PlusJakartaSans_400Regular',
    lineHeight: 16,
  },
  errorText: {
    fontSize: Typography.xs,
    fontFamily: 'PlusJakartaSans_500Medium',
    lineHeight: 16,
  },
});

export default Input;
