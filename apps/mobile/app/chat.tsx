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
import { NeuView, Fab, FAB_SIZE, haptic } from '../components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useChat } from '../hooks/useChat';
import { ChatBubble, TypingIndicator, QuickReply, AlertModal, Companion, ChatHistoryDrawer } from '../components/chat';
import { DayDivider, OpeningPrompts, SupportNote } from '../components/chat/ConversationExtras';
import { EXPRESSION_STATUS, isHeavy, type Expression } from '@prototype/utils';
import { useTheme, Neu } from '@prototype/ui-shared';
import { Spacing, BorderRadius } from '@prototype/ui-shared';

// Gap between the history button and the composer below it.
const HISTORY_FAB_GAP = 12;

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
    sessionId,
    startNewChat,
    openSession,
  } = useChat(initialSessionId);

  const [historyOpen, setHistoryOpen] = useState(false);

  // An answer tapped on the daily check-in notification waits in the composer, unsent
  const draft = params.draft as string | undefined;
  useEffect(() => { if (draft) setInputText(draft); }, [draft, setInputText]);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages, isTyping]);

  const canSend = inputText.trim().length > 0 && sessionId !== null;
  const hasUserMessage = messages.some((m) => m.sender === 'user');
  const canStartNew = hasUserMessage && !isLoadingHistory;

  // Support note lives inside the thread and only appears when the conversation turns heavy.
  // 0 = fine, 1 = heavy, 2 = very heavy. Dismissing hides it until the tier rises again.
  const tier = stressLevel >= 7 ? 2 : stressLevel >= 4 ? 1 : 0;
  const [dismissedTier, setDismissedTier] = useState(0);
  const showNote = tier > dismissedTier && hasUserMessage && !isTyping;
  // A dismissal belongs to the conversation it was made in, not the next one opened.
  useEffect(() => setDismissedTier(0), [sessionId]);

  const firstDate = messages[0]?.timestamp;
  const dayLabel = !firstDate || new Date(firstDate).toDateString() === new Date().toDateString()
    ? 'Hari ini'
    : new Date(firstDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
  // AI typing > user typing (attentive) > last reaction
  const liveExpression: Expression = isTyping ? 'berpikir' : canSend && !isHeavy(expression) ? 'senang' : expression;

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
        {/* Both side groups are two buttons wide, so "Sajiwa" stays centered */}
        <View style={s.sideGroup}>
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
        </View>

        <View style={s.navCenter} accessibilityLiveRegion="polite">
          <Text style={[s.navBrand, { color: colors.onSurface }]}>Sajiwa</Text>
          <Text style={[s.navStatus, { color: colors.onSurfaceVariant }]}>{EXPRESSION_STATUS[liveExpression]}</Text>
        </View>

        <View style={[s.sideGroup, s.sideGroupEnd]}>
          {/* New conversation. Off while this one is still untouched: a new one would be
              the same greeting with a different id. */}
          <TouchableOpacity
            style={[s.iconBtn, { backgroundColor: colors.background, boxShadow: canStartNew ? Neu.raisedSm : Neu.inset }]}
            onPress={() => { haptic.select(); startNewChat(); }}
            disabled={!canStartNew}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Percakapan baru"
            accessibilityState={{ disabled: !canStartNew }}
          >
            <Ionicons name="create-outline" size={20} color={canStartNew ? colors.primary : colors.outline} />
          </TouchableOpacity>

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
      </View>

      {/* ── Message List ── */}
      {/* Its own box so the history button can anchor to the bottom of the thread — right
          above the composer, whatever height the composer or keyboard gives it — instead of
          the bottom of the screen, where the send button already is. */}
      <View style={s.thread}>
      {isLoadingHistory ? (
        <LoadingState />
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
          ListHeaderComponent={messages.length ? <DayDivider label={dayLabel} /> : undefined}
          ListFooterComponent={
            isTyping ? (
              <TypingIndicator />
            ) : (
              <>
                {!hasUserMessage && messages.length > 0 && (
                  <View style={s.hello}>
                    <Companion expression={liveExpression} size={168} animated />
                    <Text style={[s.helloText, { color: colors.onSurfaceVariant }]}>
                      Aku di sini untuk mendengarkan, tanpa menghakimi.
                    </Text>
                  </View>
                )}
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
        <Fab
          icon="chatbubbles"
          onPress={() => setHistoryOpen(true)}
          accessibilityLabel="Riwayat percakapan"
          accessibilityHint="Membuka daftar percakapanmu sebelumnya"
          style={s.historyFab}
        />
      </View>

      {/* ── Bottom: Quick Replies + Input Bar (fused, no gap) ── */}
      <View
        style={[
          s.bottomContainer,
          {
            paddingBottom: insets.bottom + Spacing.sm,
            backgroundColor: colors.background,
            paddingLeft: hasUserMessage ? Spacing.xs : Spacing.md,
            /* borderTopColor removed for neumorphism */
          },
        ]}
      >
        {/* Companion sits beside the composer: messages above keep their full width */}
        {hasUserMessage && <Companion expression={liveExpression} animated />}

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

      <ChatHistoryDrawer
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
        currentSessionId={sessionId}
        onSelect={openSession}
        onNewChat={startNewChat}
        canStartNew={canStartNew}
      />
    </KeyboardAvoidingView>
  );
}

/* ── Loading: Sajiwa itself instead of a "Memuat riwayat..." line, in the same centered spot.
   `animated` gives it the idle breath and tap-for-a-face, so the wait feels alive. Same
   'menyapa' face and size it opens with once loaded, so the screen reads as one continuous
   arrival. The words move to the accessibility label: a picture alone would tell a screen
   reader user nothing is happening. ── */
const LoadingState: React.FC = () => (
  <View
    style={s.centered}
    accessible
    accessibilityRole="progressbar"
    accessibilityLabel="Memuat riwayat percakapan"
  >
    <Companion expression="menyapa" size={168} animated />
  </View>
);

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
  // Two 44pt buttons and the gap between them, on both sides of the title.
  sideGroup: { flexDirection: 'row', gap: Spacing.sm, width: 44 * 2 + Spacing.sm },
  sideGroupEnd: { justifyContent: 'flex-end' },
  navBrand: { fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.3 },
  navStatus: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium' },
  /* Message list */
  thread: { flex: 1 },
  msgList: {
    paddingTop: Spacing.sm,
    // Room under the newest message for the history button, so the latest turn can always
    // scroll clear of it rather than sit permanently behind it.
    paddingBottom: HISTORY_FAB_GAP + FAB_SIZE + Spacing.md,
    flexGrow: 1,
  },
  historyFab: { right: Spacing.base, bottom: HISTORY_FAB_GAP },

  /* Bottom container: chips + input, no gap between them */
  bottomContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: Spacing.xs,
    paddingLeft: Spacing.xs,
  },
  composer: { flex: 1, minWidth: 0 },
  hello: { alignItems: 'center', gap: 6, marginTop: 4, marginBottom: 18, paddingHorizontal: 32 },
  helloText: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', textAlign: 'center', lineHeight: 21 },
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
});
