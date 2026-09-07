import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Spacing } from '@prototype/ui-shared';
import { apiGetChatSessions } from '@prototype/api-client';

export default function ChatHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSessions = async () => {
    try {
      const res = await apiGetChatSessions();
      setSessions(res.sessions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSessions();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View
        style={[
          s.header,
          {
            paddingTop: insets.top + Spacing.sm,
            borderBottomColor: colors.outlineVariant + '30',
          }
        ]}
      >
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: colors.surfaceContainerLow }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={18} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.onSurface }]}>Riwayat Chat</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* ── Content ── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 20 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
        >
          {sessions.length === 0 ? (
            <View style={s.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.outline} />
              <Text style={[s.emptyText, { color: colors.onSurfaceVariant }]}>Belum ada riwayat chat.</Text>
            </View>
          ) : (
            sessions.map((session, i) => (
              <TouchableOpacity
                key={session.session_id}
                style={[s.card, { backgroundColor: colors.surfaceContainerLowest }]}
                activeOpacity={0.7}
                onPress={() => router.push(`/chat?sessionId=${session.session_id}`)}
              >
                <View style={s.cardLeft}>
                  <Text style={[s.cardTitle, { color: colors.onSurface }]} numberOfLines={1}>
                    {session.title || 'Sesi Chat Baru'}
                  </Text>
                  <Text style={[s.cardDate, { color: colors.onSurfaceVariant }]}>
                    {formatDate(session.started_at)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.outline} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: Spacing.base, gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardLeft: { flex: 1, paddingRight: 12 },
  cardTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
});
