// components/TypingIndicator.tsx — legacy root component, updated for Sanctuary
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SanctuaryColors, BorderRadius, Spacing } from '../constants/theme';

const DOT = 8;

const Dot = ({ delay }: { delay: number }) => {
  const y = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(y, { toValue: -6, duration: 320, useNativeDriver: true }),
          Animated.timing(op, { toValue: 1, duration: 320, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(y, { toValue: 0, duration: 320, useNativeDriver: true }),
          Animated.timing(op, { toValue: 0.3, duration: 320, useNativeDriver: true }),
        ]),
        Animated.delay(200),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.dot, { transform: [{ translateY: y }], opacity: op }]} />
  );
};

export const TypingIndicator: React.FC = () => (
  <View style={styles.container}>
    <View style={styles.avatarSmall}>
      <Ionicons name="leaf-outline" size={14} color={SanctuaryColors.primary} />
    </View>
    <View style={styles.bubble}>
      <View style={styles.dotsRow}>
        <Dot delay={0} />
        <Dot delay={140} />
        <Dot delay={280} />
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
  },
  avatarSmall: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: SanctuaryColors.primaryContainer + '50',
    alignItems: 'center', justifyContent: 'center',
  },
  bubble: {
    backgroundColor: SanctuaryColors.surfaceContainerLow,
    borderRadius: BorderRadius.xl,
    borderBottomLeftRadius: 4,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  dotsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  dot: {
    width: DOT, height: DOT, borderRadius: DOT / 2,
    backgroundColor: SanctuaryColors.primary + '60',
  },
});

export default TypingIndicator;
