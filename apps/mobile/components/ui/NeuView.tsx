import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { useTheme, Neu } from '@prototype/ui-shared';

export interface NeuViewProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Sunken surface (inputs, pressed states). Default is raised. */
  inset?: boolean;
  /** Smaller shadow for chips and small controls. */
  small?: boolean;
  radius?: number;
}

// Soft extruded surface: same color as the background, depth comes only from light + shade.
export const NeuView: React.FC<NeuViewProps> = ({ children, style, inset = false, small = false, radius = 16 }) => {
  const { colors } = useTheme();
  const boxShadow = inset ? Neu.inset : small ? Neu.raisedSm : Neu.raised;

  return (
    <View style={[{ backgroundColor: colors.background, borderRadius: radius }, style, { boxShadow }]}>
      {children}
    </View>
  );
};

export default NeuView;
