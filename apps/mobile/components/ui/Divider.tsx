// components/ui/Divider.tsx
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Spacing } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

interface DividerProps {
  vertical?: boolean;
  style?: ViewStyle;
  spacing?: number;
}

export const Divider: React.FC<DividerProps> = ({
  vertical = false,
  style,
  spacing = Spacing.xl,
}) => {
  const { colors } = useTheme();
  return (
    <View
      style={[
        vertical
          ? [styles.vertical, { backgroundColor: colors.divider }]
          : [styles.horizontal, { backgroundColor: colors.divider }],
        { marginVertical: vertical ? 0 : spacing },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  horizontal: { height: 1 },
  vertical:   { width: 1, alignSelf: 'stretch' },
});

export default Divider;
