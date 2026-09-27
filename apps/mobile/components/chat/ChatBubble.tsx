import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { NeuView } from '../ui/NeuView';
import { useTheme } from '@prototype/ui-shared';
import type { Message } from '@prototype/utils';

interface Props {
  message: Message;
  /** Last message of a same-sender group: show the time under it and leave a larger gap. */
  endOfGroup?: boolean;
}

export const fmtTime = (d: Date) =>
  d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });

export const ChatBubble: React.FC<Props> = ({ message, endOfGroup = true }) => {
  const isUser = message.sender === 'user';
  const { colors } = useTheme();

  const opacity = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, []);

  if (!message.text) return null;

  const time = endOfGroup ? (
    <Text style={[s.metaTime, { color: colors.textMuted }]}>{fmtTime(message.timestamp)}</Text>
  ) : null;

  return (
    <Animated.View
      style={[
        isUser ? s.rowUser : s.rowAI,
        { marginBottom: endOfGroup ? 18 : 6, opacity, transform: [{ translateY: y }] },
      ]}
      accessible
      accessibilityLabel={`${isUser ? 'Kamu' : 'Sajiwa'}, ${fmtTime(message.timestamp)}: ${message.text}`}
    >
      <View style={isUser ? s.groupUser : s.groupAI}>
        {isUser ? (
          <View style={[s.userBubble, { backgroundColor: colors.primary }, !endOfGroup && { borderBottomRightRadius: 20 }]}>
            <Text style={[s.bubbleTxt, { color: colors.onPrimary }]}>{message.text}</Text>
          </View>
        ) : (
          <NeuView small radius={20} style={[s.aiBubble, !endOfGroup && { borderBottomLeftRadius: 20 }]}>
            <Text style={[s.bubbleTxt, { color: colors.onSurface }]}>{message.text}</Text>
          </NeuView>
        )}
        {time}
      </View>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  rowUser: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16 },
  groupUser: { alignItems: 'flex-end', maxWidth: '82%', gap: 6 },
  rowAI: { flexDirection: 'row', paddingHorizontal: 16 },
  groupAI: { alignItems: 'flex-start', maxWidth: '86%', gap: 6 },

  metaTime: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', letterSpacing: 0.2, paddingHorizontal: 4 },

  userBubble: { borderRadius: 20, borderBottomRightRadius: 6, paddingHorizontal: 16, paddingVertical: 12 },
  aiBubble: { borderBottomLeftRadius: 6, paddingHorizontal: 16, paddingVertical: 12 },
  bubbleTxt: { fontSize: 15, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 24 },
});

export default ChatBubble;
