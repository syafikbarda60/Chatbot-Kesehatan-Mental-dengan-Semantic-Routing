import React, { useRef, useEffect } from 'react';
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
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { useChat } from '../hooks/useChat';
import { ChatBubble, TypingIndicator, StressBar, QuickReply, AlertModal } from '../components/chat';
import { useTheme } from '../constants/ThemeContext';
import { Spacing, BorderRadius } from '../constants/theme';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const { colors } = useTheme();

  const {
    messages,
    inputText, setInputText,
    isTyping,
    stressLevel,
    showAlert, closeAlert, confirmReport,
    quickReplies, showQuickReplies,
    sendMessage,
    sendBtnScale,
  } = useChat();

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages, isTyping]);

  const canSend = inputText.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={[s.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ── Glass Header ── */}
      <View
        style={[
          s.header,
          {
            paddingTop: insets.top + Spacing.sm,
            backgroundColor: colors.background + 'D0',
            borderBottomColor: colors.outlineVariant + '30',
          }
        ]}
      >
        {/* Nav row */}
        <View style={s.navRow}>
          <TouchableOpacity
            style={[s.backBtn, { backgroundColor: colors.surfaceContainerLow }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={18} color={colors.onSurface} />
          </TouchableOpacity>

          <View style={s.navCenter}>
            <View style={s.navLogoRow}>
              <LinearGradient
                colors={[colors.primary, colors.primaryDim]}
                style={s.navAvatar}
              >
                <Ionicons name="leaf-outline" size={14} color="#fff" />
              </LinearGradient>
              <Text style={[s.navBrand, { color: colors.onSurface }]}>Sanctuary</Text>
            </View>
          </View>

          <TouchableOpacity>
            <Ionicons name="settings-outline" size={20} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        </View>

        {/* Conversation title section */}
        <View style={s.titleSection}>
          <Text style={[s.convTitle, { color: colors.onSurface }]}>Dialogue with Sanctuary AI</Text>
          <Text style={[s.convSub, { color: colors.onSurfaceVariant }]}>
            Ruang yang tenang untuk merefleksikan pikiran dan perasaanmu.
          </Text>
        </View>
      </View>

      {/* ── Stress Bar ── */}
      <StressBar level={stressLevel} />

      {/* ── Message List ── */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item, index }) => <ChatBubble message={item} index={index} />}
        contentContainerStyle={s.msgList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState />}
        ListFooterComponent={isTyping ? <TypingIndicator /> : null}
      />

      {/* ── Quick Replies ── */}
      {showQuickReplies && messages.length < 16 && (
        <QuickReply
          options={quickReplies}
          onSelect={(t) => { sendMessage(t); Keyboard.dismiss(); }}
        />
      )}

      {/* ── Input Bar ── */}
      <View
        style={[
          s.inputBar,
          {
            paddingBottom: insets.bottom + 12,
            backgroundColor: colors.background + 'F2',
            borderTopColor: colors.outlineVariant + '20',
          }
        ]}
      >
        <View style={[s.inputWrap, { backgroundColor: colors.surfaceContainerLow }]}>
          <TextInput
            style={[s.textInput, { color: colors.onSurface }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ceritakan perasaanmu..."
            placeholderTextColor={colors.outline + '70'}
            multiline
            maxLength={500}
          />
        </View>

        <Animated.View style={{ transform: [{ scale: sendBtnScale }] }}>
          <TouchableOpacity
            onPress={() => sendMessage(inputText)}
            disabled={!canSend}
            activeOpacity={0.8}
            style={s.sendWrap}
          >
            <LinearGradient
              colors={canSend ? [colors.primary, colors.primaryDim] : [colors.surfaceContainerHigh, colors.surfaceContainerHigh]}
              style={s.sendBtn}
            >
              <Ionicons name="send" size={16} color={canSend ? '#fff' : colors.onSurfaceVariant} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
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

/* ── Empty state ── */
const EmptyState: React.FC = () => {
  const { colors } = useTheme();
  return (
    <View style={s.empty}>
      <View style={[s.emptyIcon, { backgroundColor: colors.primaryContainer + '50' }]}>
        <Ionicons name="chatbubble-ellipses-outline" size={32} color={colors.primary} />
      </View>
      <Text style={[s.emptyTitle, { color: colors.onSurface }]}>Selamat datang di Sanctuary</Text>
      <Text style={[s.emptySub, { color: colors.onSurfaceVariant }]}>
        Ceritakan apapun — AI siap mendengarkan dengan penuh empati.
      </Text>
    </View>
  );
};

/* ── Styles ── */
const s = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    borderBottomWidth: 1,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingBottom: 12,
    gap: Spacing.md,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  navCenter: { flex: 1, alignItems: 'center' },
  navLogoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navAvatar: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  navBrand: { fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.3 },

  // Conversation title
  titleSection: {
    paddingHorizontal: Spacing.xl,
    paddingTop: 4,
    paddingBottom: 20,
  },
  convTitle: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  convSub: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    lineHeight: 20,
  },

  // Messages
  msgList: {
    paddingVertical: 20,
    flexGrow: 1,
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.base,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  inputWrap: {
    flex: 1,
    borderRadius: 20,
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
  sendWrap: {
    width: 48, height: 48, borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#496175',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sendBtn: {
    width: 48, height: 48,
    alignItems: 'center', justifyContent: 'center',
  },

  // Empty
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 40,
    gap: 12,
  },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
});
