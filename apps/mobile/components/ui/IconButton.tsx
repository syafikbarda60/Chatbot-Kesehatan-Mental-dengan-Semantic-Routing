import React from 'react';
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
}

// 44px round neumorphic button; sinks in while pressed.
export const IconButton: React.FC<Props> = ({ icon, label, onPress, color, size = 44, style }) => {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          width: size, height: size, borderRadius: size / 2,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: colors.background,
          boxShadow: pressed ? Neu.inset : Neu.raisedSm,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={20} color={color ?? colors.onSurface} />
    </Pressable>
  );
};

export default IconButton;
