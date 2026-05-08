// components/ui/Badge.tsx
// Small status indicator pill — used for "AI Aktif", stress labels, etc.
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Typography, Spacing, BorderRadius } from '../../constants/theme';

interface BadgeProps {
  label: string;
  color: string;       // text + dot color
  bgColor: string;     // badge background
  dotSize?: number;
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  color,
  bgColor,
  dotSize = 5,
  style,
}) => (
  <View style={[styles.badge, { backgroundColor: bgColor }, style]}>
    <View style={[styles.dot, { width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color }]} />
    <Text style={[styles.text, { color }]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  dot: {},
  text: {
    fontSize: Typography.xs,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    letterSpacing: 0.3,
  },
});

export default Badge;
