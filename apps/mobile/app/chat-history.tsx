import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Neu } from '@prototype/ui-shared';
import { apiGetChatSessions } from '@prototype/api-client';
import { NeuView, Button, ScreenHeader, FadeIn, useToast } from '../components/ui';
import { PressableScale } from '../components/ui';
import { Companion } from '../components/chat';

export default function ChatHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const toast = useToast();

  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSessions = async () => {
    try {
      const res = await apiGetChatSessions();
      setSessions(res.sessions || []);
    } catch (err) {
      console.error(err);
      toast.show('Riwayat chat belum bisa dimuat. Tarik ke bawah untuk coba lagi.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('id-ID', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchSessions(); }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <ScreenHeader back title="Riwayat chat" subtitle="Lanjutkan percakapan sebelumnya." />

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 48 }} />
        ) : sessions.length === 0 ? (
          <NeuView inset radius={24} style={s.empty}>
            <Companion expression="menyapa" size={140} />
            <Text style={[s.emptyTitle, { color: colors.onSurface }]}>Belum ada percakapan</Text>
            <Text style={[s.emptyText, { color: colors.onSurfaceVariant }]}>
              Ceritakan apa pun yang sedang kamu rasakan. Sajiwa siap mendengarkan.
            </Text>
            <Button label="Mulai cerita" onPress={() => router.push('/chat')} style={{ alignSelf: 'stretch' }} />
          </NeuView>
        ) : (
          <View style={s.list}>
            {sessions.map((session) => (
              <FadeIn key={session.session_id}>
                <PressableScale
                  onPress={() => router.push(`/chat?sessionId=${session.session_id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`${session.title || 'Sesi chat'}, ${formatDate(session.started_at)}`}
                  style={({ pressed }) => [
                    s.card,
                    { backgroundColor: colors.background, boxShadow: pressed ? Neu.inset : Neu.raised },
                  ]}
                >
                  <View style={[s.icon, { backgroundColor: colors.background, boxShadow: Neu.inset }]}>
                    <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.cardTitle, { color: colors.onSurface }]} numberOfLines={1}>
                      {session.title || 'Sesi chat'}
                    </Text>
                    <Text style={[s.cardDate, { color: colors.onSurfaceVariant }]}>{formatDate(session.started_at)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </PressableScale>
              </FadeIn>
            ))}
            <FadeIn>
              <NeuView radius={24} style={s.more}>
                <Companion expression="senang" size={96} />
                <View style={{ flex: 1, gap: 10 }}>
                  <Text style={[s.moreTitle, { color: colors.onSurface }]}>Ada cerita baru hari ini?</Text>
                  <Button label="Mulai cerita baru" onPress={() => router.push('/chat')} />
                </View>
              </NeuView>
            </FadeIn>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  list: { gap: 16 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, marginTop: 8 },
  moreTitle: { fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 22,
  },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 3 },
  cardDate: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium' },

  empty: { alignItems: 'center', padding: 28, gap: 12 },
  emptyTitle: { fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold' },
  emptyText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center', lineHeight: 21, marginBottom: 8 },
});
