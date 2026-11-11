// Conversation history, as a panel that slides in from the right edge — the side of the
// button that opens it. Lists the student's past conversations newest first (labelled by
// how each one opened), marks the one on screen, and starts a new one.
//
// The list is fetched each time the panel opens, so a conversation started a moment ago
// is already in it. Motion runs on the UI thread, and the panel stays mounted through its
// closing slide (unmounting on `visible=false` would cut the animation off mid-frame).
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiChatSessions, type ChatSessionSummary } from '@prototype/api-client';
import { Neu, useTheme } from '@prototype/ui-shared';
import { Button, PressableScale, conversationTime, haptic } from '../ui';
import { Companion } from './Companion';
import { EXIT, FADE_MS, SPRING } from '../ui/motion';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** The conversation on screen, highlighted in the list. */
  currentSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onNewChat: () => void;
  /** False while the current conversation is still untouched: a new one would be identical. */
  canStartNew: boolean;
}

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; sessions: ChatSessionSummary[] };

export const ChatHistoryDrawer: React.FC<Props> = ({
  visible, onClose, currentSessionId, onSelect, onNewChat, canStartNew,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(width * 0.86, 360);
  const reduce = useReducedMotion();

  const [mounted, setMounted] = useState(visible);
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const progress = useSharedValue(0);

  const fetchSessions = useCallback(async () => {
    setLoad({ state: 'loading' });
    try {
      const { sessions } = await apiChatSessions();
      setLoad({ state: 'ready', sessions });
    } catch {
      setLoad({ state: 'error' });
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      fetchSessions();
      // Critically damped: the panel decelerates into place like an iOS sheet, no bounce.
      progress.value = reduce ? withTiming(1, { duration: FADE_MS }) : withSpring(1, SPRING);
    } else if (mounted) {
      progress.value = withTiming(0, EXIT, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
    // progress is a stable shared value; mounted is read only to skip a closed first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - progress.value) * panelWidth }],
  }));

  if (!mounted) return null;

  const choose = (id: string) => {
    if (id !== currentSessionId) haptic.select();
    onSelect(id);
    onClose();
  };

  const startNew = () => {
    haptic.select();
    onNewChat();
    onClose();
  };

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Tutup riwayat" accessibilityRole="button">
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }, backdropStyle]} />
      </Pressable>

      <Animated.View
        accessibilityViewIsModal
        style={[
          s.panel,
          {
            width: panelWidth,
            backgroundColor: colors.background,
            boxShadow: Neu.raised,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
          },
          panelStyle,
        ]}
      >
        <View style={s.header}>
          <Text style={[s.title, { color: colors.onSurface }]} accessibilityRole="header">
            Riwayat percakapan
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Tutup riwayat"
            style={({ pressed }) => [s.close, { backgroundColor: colors.background, boxShadow: pressed ? Neu.inset : Neu.raisedSm }]}
          >
            <Ionicons name="close" size={20} color={colors.onSurface} />
          </Pressable>
        </View>

        <Button
          label="Percakapan baru"
          onPress={startNew}
          disabled={!canStartNew}
          icon={<Ionicons name="create-outline" size={18} color="#fff" />}
          style={s.newChat}
        />
        {!canStartNew && (
          <Text style={[s.newHint, { color: colors.textMuted }]}>Kamu sedang di percakapan baru.</Text>
        )}

        {load.state === 'loading' ? (
          <ActivityIndicator color={colors.primary} style={s.centerFill} accessibilityLabel="Memuat riwayat percakapan" />
        ) : load.state === 'error' ? (
          <View style={s.centerFill}>
            <Companion expression="bingung" size={96} />
            <Text style={[s.stateText, { color: colors.onSurfaceVariant }]}>Riwayat belum bisa dimuat.</Text>
            <Button label="Coba lagi" variant="secondary" onPress={fetchSessions} />
          </View>
        ) : load.sessions.length === 0 ? (
          <View style={s.centerFill}>
            <Companion expression="menyapa" size={96} />
            <Text style={[s.stateText, { color: colors.onSurfaceVariant }]}>
              Belum ada percakapan. Mulai cerita, nanti riwayatnya muncul di sini.
            </Text>
          </View>
        ) : (
          <FlatList
            data={load.sessions}
            keyExtractor={(item) => item.session_id}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const active = item.session_id === currentSessionId;
              const when = conversationTime(item.last_message_at ?? item.started_at);
              const label = item.preview ?? 'Percakapan tanpa judul';
              return (
                <PressableScale
                  onPress={() => choose(item.session_id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${label}, ${when}${active ? ', sedang dibuka' : ''}`}
                  accessibilityState={{ selected: active }}
                  style={[s.row, { backgroundColor: colors.background, boxShadow: active ? Neu.inset : Neu.raisedSm }]}
                >
                  <View style={s.rowText}>
                    <Text
                      numberOfLines={2}
                      style={[
                        s.preview,
                        { color: item.preview ? colors.onSurface : colors.textMuted },
                        !item.preview && s.untitled,
                      ]}
                    >
                      {label}
                    </Text>
                    <Text style={[s.when, { color: active ? colors.primary : colors.textMuted }]}>
                      {active ? `Sedang dibuka · ${when}` : when}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </PressableScale>
              );
            }}
          />
        )}
      </Animated.View>
    </Modal>
  );
};

const s = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderBottomLeftRadius: 28,
    paddingHorizontal: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 19, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.4 },
  close: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  newChat: { marginBottom: 6 },
  newHint: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', textAlign: 'center', marginBottom: 6 },
  // Vertical padding so the raised rows' shadows are not clipped by the list edges.
  list: { gap: 12, paddingVertical: 12, paddingHorizontal: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 18 },
  rowText: { flex: 1, gap: 4 },
  preview: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', lineHeight: 20 },
  untitled: { fontFamily: 'PlusJakartaSans_500Medium', fontStyle: 'italic' },
  when: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium' },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 12 },
  stateText: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', textAlign: 'center', lineHeight: 21 },
});

export default ChatHistoryDrawer;
