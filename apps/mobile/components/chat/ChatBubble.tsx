// components/chat/ChatBubble.tsx
// Pixel-perfect matching Sanctuary HTML mockup:
// AI:   [avatar] [ETHEREAL AI · HH:MM]  ← meta row
//                [bubble: bg surfaceContainerLow, radius xl, bottom-left sharp]
// User:          [HH:MM · YOU]           ← meta row right-aligned
//                [bubble: bg white, shadow, radius xl, bottom-right sharp]

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../constants/ThemeContext';

export type MessageSender = 'user' | 'ai';
export interface Message {
  id: string;
  text: string;
  sender: MessageSender;
  timestamp: Date;
}

interface Props { message: Message; index: number }

const fmt = (d: Date) =>
  d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });

export const ChatBubble: React.FC<Props> = ({ message }) => {
  const isUser = message.sender === 'user';
  const { colors } = useTheme();

  const opacity = useRef(new Animated.Value(0)).current;
  const y       = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(y,       { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  }, []);

  if (isUser) {
    return (
      <Animated.View style={[s.rowUser, { opacity, transform: [{ translateY: y }] }]}>
        <View style={s.groupUser}>
          {/* Meta row: time · YOU */}
          <View style={s.metaUser}>
            <Text style={[s.metaTime, { color: colors.outline }]}>{fmt(message.timestamp)}</Text>
            <View style={[s.metaDot, { backgroundColor: colors.outlineVariant }]} />
            <Text style={[s.metaSender, { color: colors.onSurfaceVariant }]}>KAMU</Text>
          </View>
          {/* Bubble */}
          <View style={[s.userBubble, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[s.bubbleTxt, { color: colors.onSurface }]}>{message.text}</Text>
          </View>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[s.rowAI, { opacity, transform: [{ translateY: y }] }]}>
      {/* Small avatar */}
      <View style={[s.aiAvatar, { backgroundColor: colors.primaryContainer + '50' }]}>
        <Ionicons name="leaf-outline" size={14} color={colors.primary} />
      </View>

      <View style={s.groupAI}>
        {/* Meta row: SANCTUARY AI · time */}
        <View style={s.metaAI}>
          <Text style={[s.metaSender, { color: colors.primary }]}>SANCTUARY AI</Text>
          <View style={[s.metaDot, { backgroundColor: colors.outlineVariant }]} />
          <Text style={[s.metaTime, { color: colors.outline }]}>{fmt(message.timestamp)}</Text>
        </View>
        {/* Bubble */}
        <View style={[s.aiBubble, { backgroundColor: colors.surfaceContainerLow }]}>
          <Text style={[s.bubbleTxt, { color: colors.onSurface }]}>{message.text}</Text>
        </View>
      </View>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  /* User row */
  rowUser: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  groupUser: {
    alignItems: 'flex-end',
    maxWidth: '85%',
    gap: 6,
  },
  metaUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'flex-end',
  },

  /* AI row */
  rowAI: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 10,
  },
  aiAvatar: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 20, // align with bubble (below meta row)
    flexShrink: 0,
  },
  groupAI: {
    alignItems: 'flex-start',
    flex: 1,
    gap: 6,
  },
  metaAI: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  /* Meta shared */
  metaSender: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  metaTime: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  metaDot: {
    width: 3, height: 3, borderRadius: 1.5,
  },

  /* Bubbles */
  userBubble: {
    borderRadius: 20,
    borderBottomRightRadius: 4,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: '#2b3437',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  aiBubble: {
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  bubbleTxt: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
    lineHeight: 24,
  },
});

export default ChatBubble;
