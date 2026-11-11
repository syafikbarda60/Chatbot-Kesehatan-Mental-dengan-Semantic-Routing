// Floating round button, bottom right: the chat shortcut above the tab bar, and the history
// button in chat. One component so both always look and press the same. Same language as
// a primary Button: navy (the Sajiwa/chat color), raised, pressed into the surface.
// Positioning (`bottom`, `right`) is the caller's, since each sits above something different.
import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Neu, useTheme } from '@prototype/ui-shared';
import { PressableScale } from './PressableScale';

export const FAB_SIZE = 56;

interface FabProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

export const Fab: React.FC<FabProps> = ({ icon, onPress, accessibilityLabel, accessibilityHint, style }) => {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.92}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        s.fab,
        { backgroundColor: colors.primary, boxShadow: pressed ? Neu.inset : Neu.raised },
        style,
      ]}
    >
      <Ionicons name={icon} size={24} color={colors.onPrimary} />
    </PressableScale>
  );
};

const s = StyleSheet.create({
  fab: {
    position: 'absolute',
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Fab;
