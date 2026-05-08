// components/ChatBubble.tsx — legacy file, kept for compatibility
// The canonical version is components/chat/ChatBubble.tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../constants/ThemeContext';
import { Typography, Spacing, BorderRadius } from '../constants/theme';

export type MessageSender = 'user' | 'ai';
export interface Message {
  id: string;
  text: string;
  sender: MessageSender;
  timestamp: Date;
}

interface Props {
  message: Message;
  index: number;
}

export const ChatBubble: React.FC<Props> = ({ message }) => {
  const isUser = message.sender === 'user';
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]).start();
  }, []);

  const fmt = (d: Date) =>
    d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <Animated.View
      style={[
        isUser ? styles.rowUser : styles.rowAI,
        { opacity, transform: [{ translateY: y }] },
      ]}
    >
      {!isUser && (
        <View style={[styles.aiAvatar, { backgroundColor: colors.primaryContainer + '50' }]}>
          <Ionicons name="leaf-outline" size={14} color={colors.primary} />
        </View>
      )}

      <View style={[styles.group, isUser ? styles.groupUser : styles.groupAI]}>
        <View style={[
          isUser
            ? [styles.userBubble, { backgroundColor: colors.surfaceContainerLowest }]
            : [styles.aiBubble,   { backgroundColor: colors.surfaceContainerLow }]
        ]}>
          <Text style={[styles.bubbleText, { color: colors.onSurface }]}>
            {message.text}
          </Text>
        </View>
        <Text style={[styles.time, isUser && styles.timeRight, { color: colors.textMuted }]}>
          {fmt(message.timestamp)}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  rowUser: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.md,
  },
  rowAI: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  group:     { maxWidth: '78%', gap: 4 },
  groupUser: { alignItems: 'flex-end' },
  groupAI:   { alignItems: 'flex-start', flex: 1 },

  userBubble: {
    borderRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  aiBubble: {
    borderRadius: BorderRadius.xl,
    borderBottomLeftRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  bubbleText: {
    fontSize: Typography.base,
    fontFamily: 'PlusJakartaSans_500Medium',
    lineHeight: Typography.base * 1.55,
  },
  aiAvatar: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  time:      { fontSize: Typography.xs - 1, fontFamily: 'PlusJakartaSans_400Regular' },
  timeRight: { textAlign: 'right' },
});

export default ChatBubble;
