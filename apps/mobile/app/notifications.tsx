import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Spacing, Neu } from '@prototype/ui-shared';
import { apiMarkAllMyNotificationsRead, apiMarkMyNotificationRead, type MyNotification } from '@prototype/api-client';
import { Button, FadeIn, PressableScale, ScreenHeader } from '../components/ui';
import { Companion } from '../components/chat';
import { markReadLocally, refreshInbox, useInboxState } from '../hooks/useInbox';

// The app's tabs; anything else is a screen pushed on top
const TABS = new Set(['/home', '/chat', '/assessment', '/profile', '/schedule', '/journal-history']);

function when(iso: string) {
  return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { items, unread } = useInboxState();
  useFocusEffect(useCallback(() => { refreshInbox().catch(() => {}); }, []));

  const openItem = (n: MyNotification) => {
    if (!n.read_at) { markReadLocally(n.notification_id); apiMarkMyNotificationRead(n.notification_id).catch(() => {}); }
    if (!n.target_path) return;
    if (TABS.has(n.target_path)) router.replace(n.target_path as never); else router.push(n.target_path as never);
  };
  const readAll = () => { markReadLocally(); apiMarkAllMyNotificationsRead().catch(() => {}); };

  return <View style={[s.root, { backgroundColor: colors.background }]}>
    <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}>
      <FadeIn><ScreenHeader back title="Notifikasi" subtitle={unread ? `${unread} belum dibaca` : 'Kabar terbaru soal sesi konselingmu.'} /></FadeIn>
      {unread > 0 && <Button label="Tandai semua dibaca" variant="secondary" onPress={readAll} />}
      {items.length === 0
        ? <View style={s.empty}><Companion expression="tenang" size={112} /><Text style={[s.emptyText, { color: colors.onSurfaceVariant }]}>Belum ada notifikasi. Kabar soal jadwal konselingmu akan muncul di sini.</Text></View>
        : items.map((n) => <PressableScale key={n.notification_id} onPress={() => openItem(n)} accessibilityRole="button"
            accessibilityLabel={`${n.read_at ? '' : 'Belum dibaca. '}${n.title}. ${n.body ?? ''}`}
            style={[s.card, { backgroundColor: colors.background, boxShadow: n.read_at ? Neu.raisedSm : Neu.raised }]}>
            <View style={[s.icon, { backgroundColor: n.read_at ? colors.surfaceVariant ?? colors.background : colors.primary }]}>
              <Ionicons name="calendar-outline" size={18} color={n.read_at ? colors.onSurfaceVariant : colors.onPrimary ?? '#fff'} />
            </View>
            <View style={s.text}>
              <Text style={[s.title, { color: colors.onSurface, fontFamily: n.read_at ? 'PlusJakartaSans_600SemiBold' : 'PlusJakartaSans_800ExtraBold' }]}>{n.title}</Text>
              {n.body ? <Text style={[s.body, { color: colors.onSurfaceVariant }]}>{n.body}</Text> : null}
              <Text style={[s.time, { color: colors.outline }]}>{when(n.created_at)}</Text>
            </View>
            {!n.read_at && <View style={[s.dot, { backgroundColor: colors.primary }]} />}
          </PressableScale>)}
    </ScrollView>
  </View>;
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing.base, gap: 14 },
  empty: { alignItems: 'center', gap: 14, paddingVertical: 48 },
  emptyText: { fontSize: 14, lineHeight: 21, textAlign: 'center', fontFamily: 'PlusJakartaSans_500Medium', maxWidth: 280 },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 20 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 3 },
  title: { fontSize: 15, lineHeight: 21 },
  body: { fontSize: 13, lineHeight: 19, fontFamily: 'PlusJakartaSans_500Medium' },
  time: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', marginTop: 2 },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 6 },
});
