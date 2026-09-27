// components/chat/TypingIndicator.tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Spacing } from '@prototype/ui-shared';
import { useTheme, Neu } from '@prototype/ui-shared';

const DOT = 7;

const Dot: React.FC<{ delay: number; color: string }> = ({ delay, color }) => {
  const y  = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(y,  { toValue: -5,  duration: 280, useNativeDriver: true }),
          Animated.timing(op, { toValue: 1,   duration: 280, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(y,  { toValue: 0,   duration: 280, useNativeDriver: true }),
          Animated.timing(op, { toValue: 0.4, duration: 280, useNativeDriver: true }),
        ]),
        Animated.delay(200),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[styles.dot, { transform: [{ translateY: y }], opacity: op, backgroundColor: color }]}
    />
  );
};

export const TypingIndicator: React.FC = () => {
  const { colors } = useTheme();

  return (
    <View style={styles.container} accessible accessibilityLabel="Sajiwa sedang mengetik">
      <View style={[styles.bubble, { backgroundColor: colors.background, boxShadow: Neu.raisedSm }]}>
        <Dot delay={0}   color={colors.primary} />
        <Dot delay={140} color={colors.primary} />
        <Dot delay={280} color={colors.primary} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: BorderRadius.xl,
    borderBottomLeftRadius: 4,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  dot: {
    width: DOT, height: DOT,
    borderRadius: DOT / 2,
  },
});

export default TypingIndicator;

