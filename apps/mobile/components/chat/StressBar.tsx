// components/chat/StressBar.tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Badge } from '../ui';
import { Typography, Spacing, BorderRadius, StressLevel } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

interface Props { level: number }

export const StressBar: React.FC<Props> = ({ level }) => {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(10, level));
  const anim    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: clamped / 10, duration: 600, useNativeDriver: false }).start();
  }, [clamped]);

  const color   = StressLevel.getColor(clamped);
  const label   = StressLevel.getLabel(clamped);
  const emoji   = StressLevel.getEmoji(clamped);
  const bgColor = StressLevel.getBgColor(clamped);
  const width   = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surfaceContainerLowest }]}>
      <View style={styles.row}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={[styles.label, { color: colors.textMuted }]}> Kondisi Mental</Text>
        <View style={{ flex: 1 }} />
        <Badge label={label} color={color} bgColor={bgColor} />
      </View>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <Animated.View style={[styles.fill, { width, backgroundColor: color }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap:   { paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, gap: Spacing.sm },
  row:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  emoji:  { fontSize: 14 },
  label:  { fontSize: Typography.xs, fontFamily: 'PlusJakartaSans_600SemiBold' },
  track:  { height: 4, borderRadius: BorderRadius.full, overflow: 'hidden' },
  fill:   { height: '100%', borderRadius: BorderRadius.full },
});

export default StressBar;
