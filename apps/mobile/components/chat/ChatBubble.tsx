import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { arrive } from '../ui/motion';
import { NeuView } from '../ui/NeuView';
import { useTheme } from '@prototype/ui-shared';
import type { Message } from '@prototype/utils';

interface Props {
  message: Message;
  /** Last message of a same-sender group: show the time under it and leave a larger gap. */
  endOfGroup?: boolean;
}

// Settles up into the thread on a damped spring, the way a message lands in iOS Messages.
// Web takes a plain fade: Reanimated's web layout path mispositions entering elements.
const FADE = arrive(FadeInDown);

export const fmtTime = (d: Date) =>
  d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });

// Memoised: a streaming reply replaces its own message object on every token, and the list
// re-renders 400+ times per answer. Without this, every settled bubble pays for the shadow and
// the entering animation again each time — "VirtualizedList: large list that is slow to update".
export const ChatBubble = React.memo(function ChatBubble({ message, endOfGroup = true }: Props) {
  const isUser = message.sender === 'user';
  const { colors } = useTheme();

  if (!message.text) return null;

  const time = endOfGroup ? (
    <Text style={[s.metaTime, { color: colors.textMuted }]}>{fmtTime(message.timestamp)}</Text>
  ) : null;

  return (
    <Animated.View
      entering={FADE}
      style={[
        isUser ? s.rowUser : s.rowAI,
        { marginBottom: endOfGroup ? 18 : 6 },
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
});

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
