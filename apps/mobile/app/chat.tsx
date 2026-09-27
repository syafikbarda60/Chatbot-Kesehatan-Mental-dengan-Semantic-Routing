import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Animated,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NeuView } from '../components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useChat } from '../hooks/useChat';
import { ChatBubble, TypingIndicator, QuickReply, AlertModal, Companion } from '../components/chat';
import { DayDivider, OpeningPrompts, SupportNote } from '../components/chat/ConversationExtras';
import { EXPRESSION_STATUS, type Expression } from '@prototype/utils';
import { useTheme, Neu } from '@prototype/ui-shared';
import { Spacing, BorderRadius } from '@prototype/ui-shared';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const { colors } = useTheme();

  const params = useLocalSearchParams();
  const initialSessionId = params.sessionId as string | undefined;

  const {
    messages,
    inputText, setInputText,
    isTyping,
    stressLevel,
    showAlert, closeAlert, confirmReport,
    quickReplies, showQuickReplies,
    sendMessage,
    sendBtnScale,
    isLoadingHistory,
    setShowAlert,
    setAlertTriggered,
    expression,
  } = useChat(initialSessionId);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages, isTyping]);

  const canSend = inputText.trim().length > 0;
  const hasUserMessage = messages.some((m) => m.sender === 'user');

  // Support note lives inside the thread and only appears when the conversation turns heavy.
  // 0 = fine, 1 = heavy, 2 = very heavy. Dismissing hides it until the tier rises again.
  const tier = stressLevel >= 7 ? 2 : stressLevel >= 4 ? 1 : 0;
  const [dismissedTier, setDismissedTier] = useState(0);
  const showNote = tier > dismissedTier && hasUserMessage && !isTyping;

  const firstDate = messages[0]?.timestamp;
  const dayLabel = !firstDate || new Date(firstDate).toDateString() === new Date().toDateString()
    ? 'Hari ini'
    : new Date(firstDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
  // AI typing > user typing (attentive) > last reaction
  const liveExpression: Expression = isTyping ? 'berpikir' : canSend && expression !== 'tenang' ? 'senang' : expression;

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* ── Header: flows in document order, not absolute ── */}
      <View
        style={[
          s.header,
          {
            paddingTop: insets.top + Spacing.sm,
            backgroundColor: colors.background,
          },
        ]}
      >
        <TouchableOpacity
          style={[s.iconBtn, { backgroundColor: colors.background, boxShadow: Neu.raisedSm }]}
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/home');
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={colors.onSurface} />
        </TouchableOpacity>

        <View style={s.navCenter} accessibilityLiveRegion="polite">
          <Text style={[s.navBrand, { color: colors.onSurface }]}>Sajiwa</Text>
          <Text style={[s.navStatus, { color: colors.onSurfaceVariant }]}>{EXPRESSION_STATUS[liveExpression]}</Text>
        </View>

        {/* Always-visible path to human help */}
        <TouchableOpacity
          style={[s.iconBtn, { backgroundColor: colors.background, boxShadow: Neu.raisedSm }]}
          onPress={() => router.push('/hotline')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Hotline darurat"
        >
          <Ionicons name="call-outline" size={20} color={colors.stressHigh} />
        </TouchableOpacity>
      </View>

      {/* ── Message List ── */}
      {isLoadingHistory ? (
        <LoadingState color={colors.onSurfaceVariant} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item, index }) => {
            const next = messages[index + 1];
            // A group ends when the sender changes or the next message comes 5+ minutes later
            const endOfGroup =
              !next || next.sender !== item.sender ||
              new Date(next.timestamp).getTime() - new Date(item.timestamp).getTime() > 5 * 60 * 1000;
            return <ChatBubble message={item} endOfGroup={endOfGroup} />;
          }}
          contentContainerStyle={s.msgList}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={messages.length ? <DayDivider label={dayLabel} /> : null}
          ListEmptyComponent={<EmptyState />}
          ListFooterComponent={
            isTyping ? (
              <TypingIndicator />
            ) : (
              <>
                {!hasUserMessage && messages.length > 0 && (
                  <OpeningPrompts onPick={(t) => { sendMessage(t); Keyboard.dismiss(); }} />
                )}
                {showNote && (
                  <SupportNote
                    heavy={tier === 2}
                    onPrimary={() => {
                      if (tier === 2) { setShowAlert(true); setAlertTriggered(true); }
                      else router.push('/journal');
                    }}
                    onDismiss={() => setDismissedTier(tier)}
                  />
                )}
              </>
            )
          }
        />
      )}

      {/* ── Bottom: Quick Replies + Input Bar (fused, no gap) ── */}
      <View
        style={[
          s.bottomContainer,
          {
            paddingBottom: insets.bottom + Spacing.sm,
            backgroundColor: colors.background,
            /* borderTopColor removed for neumorphism */
          },
        ]}
      >
        {/* Companion sits beside the composer: messages above keep their full width */}
        <Companion expression={liveExpression} />

        <View style={s.composer}>
        {/* Suggestions only once the user is in a heavy moment; openers cover the fresh start */}
        {showQuickReplies && hasUserMessage && tier >= 1 && !showNote && (
          <QuickReply
            options={quickReplies}
            onSelect={(t) => { sendMessage(t); Keyboard.dismiss(); }}
          />
        )}

        <View style={s.inputRow}>
          <NeuView
            inset
            radius={24}
            style={s.inputPill}
          >
            <TextInput
              accessibilityLabel="Tulis pesan"
              style={[s.textInput, { color: colors.onSurface }]}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Tulis sesuatu..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={500}
            />
          </NeuView>

          <Animated.View style={{ transform: [{ scale: sendBtnScale }] }}>
            <TouchableOpacity
              onPress={() => sendMessage(inputText)}
              disabled={!canSend}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Kirim pesan"
              accessibilityState={{ disabled: !canSend }}
            >
              <View
                style={[
                  s.sendBtn,
                  canSend
                    ? { backgroundColor: colors.primary, boxShadow: Neu.raised }
                    : { backgroundColor: colors.background, boxShadow: Neu.raisedSm },
                ]}
              >
                <Ionicons name="arrow-up" size={20} color={canSend ? colors.onPrimary : colors.textMuted} />
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>
        </View>
      </View>

      <AlertModal
        visible={showAlert}
        stressLevel={Math.round(stressLevel)}
        onDismiss={closeAlert}
        onConfirmReport={confirmReport}
      />
    </KeyboardAvoidingView>
  );
}

/* ── Loading skeleton ── */
const LoadingState: React.FC<{ color: string }> = ({ color }) => (
  <View style={s.centered}>
    <Text style={[s.loadingTxt, { color }]}>Memuat riwayat...</Text>
  </View>
);

/* ── Empty state: editorial, left-aligned, generous whitespace ── */
const EmptyState: React.FC = () => {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, delay: 100, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, delay: 100, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        s.empty,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Text style={[s.emptyTitle, { color: colors.onSurface }]}>
        Ruang Refleksimu
      </Text>
      <Text style={[s.emptySub, { color: colors.onSurfaceVariant }]}>
        Ceritakan apapun. Sajiwa mendengarkan dengan penuh empati, tanpa penghakiman.
      </Text>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1 },

  /* Header — normal document flow */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  iconBtn: {
    width: 44, height: 44,
    borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  navCenter: {
    flex: 1,
    alignItems: 'center',
  },
  navBrand: { fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.3 },
  navStatus: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium' },
  /* Message list */
  msgList: {
    paddingVertical: Spacing.sm,
    flexGrow: 1,
  },

  /* Bottom container: chips + input, no gap between them */
  bottomContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: Spacing.xs,
    paddingLeft: Spacing.xs,
  },
  composer: { flex: 1, minWidth: 0 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingLeft: Spacing.xs,
    paddingRight: Spacing.base,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  inputPill: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    maxHeight: 120,
  },
  textInput: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    lineHeight: 22,
    maxHeight: 100,
    padding: 0, margin: 0,
  },
  sendBtn: {
    width: 48, height: 48,
    borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    
  },

  /* Loading */
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingTxt: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    letterSpacing: 0.5,
  },

  /* Empty state — left-aligned editorial */
  empty: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: 28, fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: -0.8,
    lineHeight: 34,
  },
  emptySub: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
    lineHeight: 24,
    maxWidth: '88%',
  },
});
