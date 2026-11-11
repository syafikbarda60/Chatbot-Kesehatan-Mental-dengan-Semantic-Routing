// Hero for login/register: the companion climbs out of a deep neumorphic "portal".
// A raised disc holds a sunken well; the character is clipped only by the well's lower
// half, so its head pops above the rim. A speech bubble sits at the top right.
import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '@prototype/ui-shared';
import type { Expression } from '@prototype/utils';
import { Companion } from './chat';

// Bolder than the app-wide Neu tokens: this is the one place the depth is the hero
const LIGHT = 'rgba(255,255,255,0.95)';
const DARK = 'rgba(122,134,168,0.55)';
const DISC = `-16px -16px 32px ${LIGHT}, 16px 16px 34px ${DARK}`;
const WELL = `inset 12px 12px 24px ${DARK}, inset -12px -12px 24px ${LIGHT}`;
const BUBBLE = `-6px -6px 14px ${LIGHT}, 6px 6px 14px ${DARK}`;

interface Props {
  expression: Expression;
  say: string;
  /** Share of the screen width the disc may take (clamped to 180–270dp). */
  scale?: number;
}

export const AuthStage: React.FC<Props> = ({ expression, say, scale = 0.62 }) => {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const D = Math.round(Math.min(270, Math.max(180, width * scale))); // disc diameter
  const RIM = Math.round(D * 0.09);
  const W = D - RIM * 2; // well diameter
  const LIFT = Math.round(D * 0.3); // how far the head rises above the rim

  return (
    <View style={{ width: D, height: D + LIFT, alignSelf: 'center' }}>
      {/* Raised disc + sunken well */}
      <View style={[s.disc, { width: D, height: D, borderRadius: D / 2, backgroundColor: colors.background, boxShadow: DISC }]}>
        <View style={{ width: W, height: W, borderRadius: W / 2, backgroundColor: colors.background, boxShadow: WELL }} />
      </View>

      {/* Character: bottom clipped to the well's curve, top left open so the head pops out */}
      <View
        style={{
          position: 'absolute', left: RIM, bottom: RIM, width: W, height: W + LIFT,
          overflow: 'hidden', borderBottomLeftRadius: W / 2, borderBottomRightRadius: W / 2,
          alignItems: 'center', justifyContent: 'flex-end',
        }}
      >
        <Companion expression={expression} size={Math.round(W * 1.34)} />
      </View>

      {/* Speech bubble, tail pointing down-left at the character */}
      {/* Explicit width: an absolute child would otherwise shrink to the stage's right edge */}
      <View style={[s.bubble, { left: D * 0.66, width: Math.min(172, Math.max(112, (width - D) / 2 + D * 0.34 - 12)), backgroundColor: colors.background, boxShadow: BUBBLE }]}>
        <Text style={[s.bubbleText, { color: colors.onSurface }]}>{say}</Text>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  disc: { position: 'absolute', bottom: 0, alignItems: 'center', justifyContent: 'center' },
  bubble: {
    position: 'absolute', top: 0,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 18, borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 14, lineHeight: 19, fontFamily: 'PlusJakartaSans_700Bold' },
});

export default AuthStage;
