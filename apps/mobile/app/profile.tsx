import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { apiFetch, apiGetChatSessions, apiGetJournals, apiGetBookingSaya, apiGetKonselor } from '@prototype/api-client';

import {
  BottomNav, FadeIn, NeuView, Button, ScreenHeader, useToast,
  Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../components/ui';
import { Companion } from '../components/chat';
import { useTheme, useAuth, Neu, Spacing } from '@prototype/ui-shared';
import { moodOf } from '../constants/moods';

type Booking = {
  status: string;
  jadwal_konsultasi?: { tanggal: string; waktu_mulai: string; waktu_selesai: string; konselor_id: string };
};

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const hm = (t?: string) => (t ?? '').substring(0, 5);

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { logout, user } = useAuth();
  const toast = useToast();

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [joinedAt, setJoinedAt] = useState<string | null>(null);
  const [sessions, setSessions] = useState(0);
  const [journals, setJournals] = useState<any[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [counselors, setCounselors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      try {
        const [me, chatRes, journalRes] = await Promise.all([
          apiFetch<{ created_at?: string }>('/auth/me'),
          apiGetChatSessions(),
          apiGetJournals(100, 0),
        ]);
        setJoinedAt(me.created_at ?? null);
        setSessions(chatRes.sessions?.length || 0);
        setJournals(journalRes.journals || []);
      } catch (err) {
        console.error('Failed to load profile stats:', err);
        toast.show('Ringkasan aktivitas belum bisa dimuat.', 'error');
      }
      // Counseling info is optional: never fail the whole profile over it
      Promise.all([apiGetBookingSaya(), apiGetKonselor()])
        .then(([b, k]) => {
          setBookings(b.bookings as Booking[]);
          setCounselors(Object.fromEntries(k.users.map((u: any) => [u.user_id, u.nama])));
        })
        .catch(() => {});
    }
    load();
  }, []);

  // ── Journey numbers, all derived from real data ──
  const journey = useMemo(() => {
    const days = new Set(journals.map((j) => dayKey(new Date(j.created_at))));
    let streak = 0;
    const cursor = new Date();
    if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (days.has(dayKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    const tally: Record<string, number> = {};
    journals.forEach((j) => j.mood && (tally[j.mood] = (tally[j.mood] || 0) + 1));
    const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    return { streak, topMood: top ? moodOf(top[0]) : undefined };
  }, [journals]);

  const today = new Date().toISOString().slice(0, 10);
  const nextSession = bookings
    .filter((b) => (b.status === 'menunggu' || b.status === 'dikonfirmasi') && (b.jadwal_konsultasi?.tanggal ?? '') >= today)
    .sort((a, b) => `${a.jadwal_konsultasi!.tanggal}${a.jadwal_konsultasi!.waktu_mulai}`.localeCompare(`${b.jadwal_konsultasi!.tanggal}${b.jadwal_konsultasi!.waktu_mulai}`))[0];

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    await logout();
    toast.show('Kamu sudah keluar. Sampai jumpa lagi!', 'info');
    router.replace('/');
  };

  const initials = (user?.nama || 'S').split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase()).join('');
  const joinedLabel = joinedAt
    ? `Bergabung sejak ${new Date(joinedAt).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`
    : null;

  const tiles = [
    { icon: 'chatbubbles-outline', value: String(sessions), label: 'sesi percakapan', color: colors.primary, to: '/chat-history' },
    { icon: 'book-outline', value: String(journals.length), label: 'catatan jurnal', color: colors.primary, to: '/journal-history' },
    { icon: 'flame-outline', value: String(journey.streak), label: 'hari menulis berturut-turut', color: colors.stressMid, to: '/journal-history' },
    journey.topMood
      ? { icon: journey.topMood.icon, value: journey.topMood.label, label: 'suasana paling sering', color: journey.topMood.color, to: '/stats' }
      : { icon: 'leaf-outline', value: '–', label: 'suasana paling sering', color: colors.onSurfaceVariant, to: '/stats' },
  ];

  const groups = [
    {
      title: 'Aktivitas',
      items: [
        { icon: 'time-outline', label: 'Riwayat chat', to: '/chat-history' },
        { icon: 'book-outline', label: 'Jurnal', to: '/journal-history' },
        { icon: 'stats-chart-outline', label: 'Laporan mingguan', to: '/stats' },
      ],
    },
    {
      title: 'Bantuan',
      items: [
        { icon: 'calendar-outline', label: 'Konseling', to: '/schedule' },
        { icon: 'call-outline', label: 'Hotline darurat', to: '/hotline', danger: true },
      ],
    },
  ];

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 }]}
      >
        <ScreenHeader title="Profil" />

        {/* ── Identity, with the companion beside you ── */}
        <FadeIn delay={0}>
          <NeuView radius={28} style={s.identity}>
            <View style={[s.avatar, { backgroundColor: colors.background, boxShadow: Neu.inset }]}>
              <Text style={[s.avatarText, { color: colors.primary }]}>{initials}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[s.name, { color: colors.onSurface }]} numberOfLines={2}>{user?.nama || 'Pengguna'}</Text>
              <Text style={[s.meta, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                {user?.nim ? `NIM ${user.nim}` : user?.email || ''}
              </Text>
              {joinedLabel && <Text style={[s.joined, { color: colors.textMuted }]}>{joinedLabel}</Text>}
            </View>
            <Companion expression="senang" size={84} />
          </NeuView>
        </FadeIn>

        {/* ── Your journey ── */}
        <FadeIn delay={80}>
          <View style={{ gap: 12 }}>
            <Text style={[s.sectionTitle, { color: colors.onSurface }]} accessibilityRole="header">Perjalananmu</Text>
            <View style={s.grid}>
              {tiles.map((t) => (
                <Pressable
                  key={t.label}
                  onPress={() => router.push(t.to as any)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.value} ${t.label}`}
                  style={({ pressed }) => [s.tile, { backgroundColor: colors.background, boxShadow: pressed ? Neu.inset : Neu.raisedSm }]}
                >
                  <Ionicons name={t.icon as any} size={20} color={t.color} />
                  <Text style={[s.tileValue, { color: t.color === colors.primary ? colors.onSurface : t.color }]} numberOfLines={1}>
                    {t.value}
                  </Text>
                  <Text style={[s.tileLabel, { color: colors.onSurfaceVariant }]} numberOfLines={2}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </FadeIn>

        {/* ── Next counseling session (only when there is one) ── */}
        {nextSession?.jadwal_konsultasi && (
          <FadeIn delay={140}>
            <Pressable
              onPress={() => router.push('/schedule')}
              accessibilityRole="button"
              style={({ pressed }) => [s.session, { backgroundColor: colors.background, boxShadow: pressed ? Neu.inset : Neu.raised }]}
            >
              <View style={[s.sessionDate, { backgroundColor: colors.primary }]}>
                <Text style={s.sessionDay}>{new Date(nextSession.jadwal_konsultasi.tanggal).getDate()}</Text>
                <Text style={s.sessionMonth}>
                  {new Date(nextSession.jadwal_konsultasi.tanggal).toLocaleDateString('id-ID', { month: 'short' })}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[s.sessionLabel, { color: colors.onSurfaceVariant }]}>Sesi konseling berikutnya</Text>
                <Text style={[s.sessionName, { color: colors.onSurface }]} numberOfLines={1}>
                  {counselors[nextSession.jadwal_konsultasi.konselor_id] ?? 'Konselor kampus'}
                </Text>
                <Text style={[s.sessionMeta, { color: nextSession.status === 'dikonfirmasi' ? '#3B7A56' : colors.stressMid }]}>
                  {hm(nextSession.jadwal_konsultasi.waktu_mulai)}–{hm(nextSession.jadwal_konsultasi.waktu_selesai)} ·{' '}
                  {nextSession.status === 'dikonfirmasi' ? 'Dikonfirmasi' : 'Menunggu konfirmasi'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </FadeIn>
        )}

        {/* ── Menu ── */}
        {groups.map((g, gi) => (
          <FadeIn key={g.title} delay={200 + gi * 60}>
            <View style={{ gap: 10 }}>
              <Text style={[s.groupTitle, { color: colors.onSurfaceVariant }]}>{g.title}</Text>
              <NeuView radius={24} style={s.menuCard}>
                {g.items.map((item) => (
                  <Pressable
                    key={item.label}
                    onPress={() => router.push(item.to as any)}
                    accessibilityRole="button"
                    style={({ pressed }) => [s.menuItem, pressed && { backgroundColor: colors.background, boxShadow: Neu.inset }]}
                  >
                    <Ionicons name={item.icon as any} size={20} color={(item as any).danger ? colors.stressHigh : colors.primary} />
                    <Text style={[s.menuLabel, { color: colors.onSurface }]}>{item.label}</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>
                ))}
              </NeuView>
            </View>
          </FadeIn>
        ))}

        {/* ── Privacy, stated honestly ── */}
        <FadeIn delay={320}>
          <NeuView inset radius={20} style={s.privacy}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
            <Text style={[s.privacyText, { color: colors.onSurfaceVariant }]}>
              Isi percakapan dan jurnalmu hanya bisa dibuka lewat akunmu, dan percakapan disimpan terenkripsi.
              Konselor hanya menerima tanda bahaya yang terdeteksi, demi keselamatanmu.
            </Text>
          </NeuView>
        </FadeIn>

        <FadeIn delay={360}>
          <Button
            label="Keluar"
            variant="secondary"
            onPress={() => setShowLogoutModal(true)}
            textStyle={{ color: colors.error }}
            icon={<Ionicons name="log-out-outline" size={18} color={colors.error} />}
          />
        </FadeIn>

        <Text style={[s.version, { color: colors.textMuted }]}>Sajiwa v1.0.0 Beta</Text>
      </ScrollView>

      <BottomNav />

      <Dialog open={showLogoutModal} onOpenChange={setShowLogoutModal}>
        <DialogHeader>
          <DialogTitle>Keluar dari akun?</DialogTitle>
          <DialogDescription>Kamu perlu masuk lagi untuk membuka Sajiwa.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button label="Batal" variant="ghost" onPress={() => setShowLogoutModal(false)} style={{ flex: 1 }} />
          <Button label="Ya, keluar" variant="danger" onPress={confirmLogout} style={{ flex: 1 }} />
        </DialogFooter>
      </Dialog>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.lg, gap: 24 },

  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 18, paddingVertical: 14, paddingRight: 8 },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  name: { fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.3 },
  meta: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium' },
  joined: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', marginTop: 2 },

  sectionTitle: { fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexBasis: '46%', flexGrow: 1, padding: 16, borderRadius: 22, gap: 6, minHeight: 116 },
  tileValue: { fontSize: 24, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.5, marginTop: 4 },
  tileLabel: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', lineHeight: 18 },

  session: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 24 },
  sessionDate: { width: 56, height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sessionDay: { fontSize: 22, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#fff', lineHeight: 26 },
  sessionMonth: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: 'rgba(255,255,255,0.85)' },
  sessionLabel: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold' },
  sessionName: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold' },
  sessionMeta: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold' },

  groupTitle: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', paddingHorizontal: 4 },
  menuCard: { padding: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 54, paddingHorizontal: 14, borderRadius: 16 },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold' },

  privacy: { flexDirection: 'row', gap: 12, padding: 16, alignItems: 'flex-start' },
  privacyText: { flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', lineHeight: 20 },

  version: { textAlign: 'center', fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular' },
});
