import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius, StressLevel } from '../constants/theme';

interface Props { level: number }

export const StressBar: React.FC<Props> = ({ level }) => {
  const clamped = Math.max(0, Math.min(10, level));
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: clamped / 10, duration: 600, useNativeDriver: false }).start();
  }, [clamped]);

  const color = StressLevel.getColor(clamped);
  const label = StressLevel.getLabel(clamped);
  const emoji = StressLevel.getEmoji(clamped);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={styles.label}> Status</Text>
        <View style={{ flex: 1 }} />
        <View style={[styles.badge, { backgroundColor: StressLevel.getBgColor(clamped) }]}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={[styles.badgeText, { color }]}>{label}</Text>
        </View>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width, backgroundColor: color }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  emoji: { fontSize: 14 },
  label: { fontSize: Typography.xs, color: Colors.textMuted, fontFamily: 'Inter_500Medium' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontSize: Typography.xs, fontFamily: 'Inter_600SemiBold' },
  track: {
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: BorderRadius.full },
});

export default StressBar;
