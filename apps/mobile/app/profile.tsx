import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { apiFetch, apiGetJournals } from '@prototype/api-client';

import {
  BottomNav, BOTTOM_CLEARANCE, FadeIn, NeuView, Button, ScreenHeader, useToast,
  Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../components/ui';
import { Companion } from '../components/chat';
import { useTheme, useAuth, Neu, Spacing } from '@prototype/ui-shared';
import { moodOf } from '../constants/moods';
import { PressableScale, clockTime } from '../components/ui';
import { useUpcomingSession } from '../hooks/useUpcomingSession';
import { NotificationSettings } from '../components/NotificationSettings';

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { logout, user } = useAuth();
  const toast = useToast();

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [joinedAt, setJoinedAt] = useState<string | null>(null);
  const [journals, setJournals] = useState<any[]>([]);
  const { upcoming: nextSession } = useUpcomingSession();

  useEffect(() => {
    async function load() {
      try {
        const [me, journalRes] = await Promise.all([
          apiFetch<{ created_at?: string }>('/auth/me'),
          apiGetJournals(100, 0),
        ]);
        setJoinedAt(me.created_at ?? null);
        setJournals(journalRes.journals || []);
      } catch (err) {
        console.error('Failed to load profile stats:', err);
        toast.show('Ringkasan aktivitas belum bisa dimuat.', 'error');
      }
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


  const confirmLogout = async () => {
    setShowLogoutModal(false);
    await logout();
    toast.show('Kamu sudah keluar. Sampai jumpa lagi!', 'info');
    router.replace('/');
  };

  const initials = (user?.name || 'S').split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase()).join('');
  const joinedLabel = joinedAt
    ? `Bergabung sejak ${new Date(joinedAt).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`
    : null;

  const tiles = [
    { icon: 'book-outline', value: String(journals.length), label: 'catatan jurnal', color: colors.sage },
    { icon: 'flame-outline', value: String(journey.streak), label: 'hari berturut-turut', color: colors.stressMid },
    journey.topMood
      ? { icon: journey.topMood.icon, value: journey.topMood.label, label: 'suasana tersering', color: journey.topMood.color }
      : { icon: 'leaf-outline', value: '–', label: 'suasana tersering', color: colors.onSurfaceVariant },
  ];

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + BOTTOM_CLEARANCE }]}
      >
        <ScreenHeader title="Profil" />

        {/* ── Identity, with the companion beside you ── */}
        <FadeIn>
          <NeuView radius={28} style={s.identity}>
            <View style={[s.avatar, { backgroundColor: colors.background, boxShadow: Neu.inset }]}>
              <Text style={[s.avatarText, { color: colors.primary }]}>{initials}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[s.name, { color: colors.onSurface }]} numberOfLines={2}>{user?.name || 'Pengguna'}</Text>
              <Text style={[s.meta, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                {user?.nim ? `NIM ${user.nim}` : user?.email || ''}
              </Text>
              {joinedLabel && <Text style={[s.joined, { color: colors.textMuted }]}>{joinedLabel}</Text>}
            </View>
            <Companion expression="senang" size={84} />
          </NeuView>
        </FadeIn>

        {/* ── Your journey ── */}
        <FadeIn>
          <View style={{ gap: 12 }}>
            <Text style={[s.sectionTitle, { color: colors.onSurface }]} accessibilityRole="header">Perjalananmu</Text>
            <View style={s.grid}>
              {tiles.map((t) => (
                <View
                  key={t.label}
                  accessible
                  accessibilityLabel={`${t.value} ${t.label}`}
                  style={[s.tile, { backgroundColor: colors.background, boxShadow: Neu.raisedSm }]}
                >
                  <Ionicons name={t.icon as any} size={20} color={t.color} />
                  <Text style={[s.tileValue, { color: t.color === colors.primary || t.color === colors.sage ? colors.onSurface : t.color }]} numberOfLines={1}>
                    {t.value}
                  </Text>
                  <Text style={[s.tileLabel, { color: colors.onSurfaceVariant }]} numberOfLines={2}>{t.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </FadeIn>

        {/* ── Next counseling session (only when there is one) ── */}
        {nextSession && (
          <FadeIn>
            <PressableScale
              onPress={() => router.push('/schedule')}
              accessibilityRole="button"
              style={({ pressed }) => [s.session, { backgroundColor: colors.background, boxShadow: pressed ? Neu.inset : Neu.raised }]}
            >
              <View style={[s.sessionDate, { backgroundColor: colors.amberFill }]}>
                <Text style={s.sessionDay}>{new Date(nextSession.start).getDate()}</Text>
                <Text style={s.sessionMonth}>
                  {new Date(nextSession.start).toLocaleDateString('id-ID', { month: 'short' })}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[s.sessionLabel, { color: colors.onSurfaceVariant }]}>Sesi konseling berikutnya</Text>
                <Text style={[s.sessionName, { color: colors.onSurface }]} numberOfLines={1}>
                  {nextSession.counselor ?? 'Konselor kampus'}
                </Text>
                <Text style={[s.sessionMeta, { color: nextSession.status === 'confirmed' ? '#3B7A56' : colors.stressMid }]}>
                  {clockTime(nextSession.start)}–{clockTime(nextSession.end)} ·{' '}
                  {nextSession.status === 'confirmed' ? 'Dikonfirmasi' : 'Menunggu konfirmasi'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </PressableScale>
          </FadeIn>
        )}

        <FadeIn><NotificationSettings /></FadeIn>

        {/* The one destination the bottom nav does not reach */}
        <FadeIn>
          <PressableScale
            onPress={() => router.push('/hotline')}
            accessibilityRole="button"
            accessibilityLabel="Hotline darurat"
            style={({ pressed }) => [s.hotline, { backgroundColor: colors.background, boxShadow: pressed ? Neu.inset : Neu.raisedSm }]}
          >
            <View style={[s.hotlineIcon, { backgroundColor: colors.stressHigh }]}>
              <Ionicons name="call" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.menuLabel, { color: colors.onSurface }]}>Hotline darurat</Text>
              <Text style={[s.hotlineHint, { color: colors.onSurfaceVariant }]}>Bantuan profesional, gratis dan rahasia</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </PressableScale>
        </FadeIn>

        {/* ── Privacy, stated honestly ── */}
        <FadeIn>
          <NeuView inset radius={20} style={s.privacy}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
            <Text style={[s.privacyText, { color: colors.onSurfaceVariant }]}>
              Isi percakapan dan jurnalmu hanya bisa dibuka lewat akunmu, dan percakapan disimpan terenkripsi.
              Konselor hanya menerima tanda bahaya yang terdeteksi, demi keselamatanmu.
            </Text>
          </NeuView>
        </FadeIn>

        <FadeIn>
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
  scroll: { paddingHorizontal: Spacing.lg, gap: 14 },

  identity: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingVertical: 10, paddingRight: 8 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  name: { fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.3 },
  meta: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium' },
  joined: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', marginTop: 2 },

  sectionTitle: { fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexBasis: '30%', flexGrow: 1, padding: 12, borderRadius: 18, gap: 2, minHeight: 92 },
  tileValue: { fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.5, marginTop: 4 },
  tileLabel: { fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', lineHeight: 15 },

  session: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 24 },
  sessionDate: { width: 56, height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sessionDay: { fontSize: 22, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#1C2447', lineHeight: 26 },
  sessionMonth: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#1C2447' },
  sessionLabel: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold' },
  sessionName: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold' },
  sessionMeta: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold' },

  hotline: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20 },
  hotlineIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold' },
  hotlineHint: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium' },

  privacy: { flexDirection: 'row', gap: 10, padding: 12, alignItems: 'center' },
  privacyText: { flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', lineHeight: 20 },

  version: { textAlign: 'center', fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular' },
});
