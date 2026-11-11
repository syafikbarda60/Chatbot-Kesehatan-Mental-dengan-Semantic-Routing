// Pieces shared by the sideways pagers (consent walkthrough, home hero): where a page sits
// relative to the scroll, and the stretching page dots. All of it runs on the UI thread.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

/** How far page `index` is from the centre of the pager: -1 (next), 0 (on screen), 1 (passed). */
export function offsetOf(x: number, index: number, width: number) {
  'worklet';
  return (x - index * width) / Math.max(width, 1);
}

/** One page dot; stretches into a pill and brightens as its page comes on screen. */
const Dot: React.FC<{ index: number; width: number; scrollX: SharedValue<number>; color: string }> = ({
  index, width, scrollX, color,
}) => {
  const style = useAnimatedStyle(() => {
    const p = Math.abs(offsetOf(scrollX.value, index, width));
    return {
      width: interpolate(p, [0, 1], [24, 8], Extrapolation.CLAMP),
      opacity: interpolate(p, [0, 1], [1, 0.3], Extrapolation.CLAMP),
    };
  });
  return <Animated.View style={[s.dot, { backgroundColor: color }, style]} />;
};

export const PagerDots: React.FC<{ count: number; width: number; scrollX: SharedValue<number>; color: string }> = ({
  count, width, scrollX, color,
}) => (
  <View style={s.dots} importantForAccessibility="no-hide-descendants">
    {Array.from({ length: count }, (_, i) => (
      <Dot key={i} index={i} width={width} scrollX={scrollX} color={color} />
    ))}
  </View>
);

const s = StyleSheet.create({
  dots: { flexDirection: 'row', alignSelf: 'center', gap: 7 },
  dot: { height: 8, borderRadius: 4 },
});
