import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav, useToast } from '../components/ui';
import { Companion } from '../components/chat';
import { useAuth } from '@prototype/ui-shared';
import type { Expression } from '@prototype/utils';
import {
  apiSaveJournal, apiUpdateJournal, apiGetJournals, apiGetChatSessions, apiGetBookingSaya, apiGetKonselor,
} from '@prototype/api-client';
import { MOODS, Mood, moodOf, MOOD_COMPANION } from '../constants/moods';
import { TRI, triRaised, triInset } from '../constants/palette';
import { PressableScale } from '../components/ui';

// Home trials the role-based palette: navy = Sajiwa/chat, sage = journal, amber = counseling, coral = crisis

const DAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const DAY_LONG = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const CHECKIN_PREFIX = 'Check-in cepat:';
// Switching mood within this window is a correction (update); later it's a real change (new entry)
const CORRECTION_MS = 30 * 60 * 1000;
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const hm = (t?: string) => (t ?? '').substring(0, 5);

// What Sajiwa asks, and how it looks, depends on the time of day
const moment = () => {
  const h = new Date().getHours();
  if (h < 11) return { greet: 'Selamat pagi', ask: 'Pagi ini gimana perasaanmu?', face: 'semangat' as Expression };
  if (h < 15) return { greet: 'Selamat siang', ask: 'Siang ini gimana harimu?', face: 'senang' as Expression };
  if (h < 18) return { greet: 'Selamat sore', ask: 'Sore ini gimana perasaanmu?', face: 'menyapa' as Expression };
  if (h < 22) return { greet: 'Selamat malam', ask: 'Malam ini, ada yang ingin kamu ceritakan?', face: 'tenang' as Expression };
  return { greet: 'Selamat malam', ask: 'Belum tidur? Aku temani sebentar.', face: 'mengantuk' as Expression };
};

type Booking = { status: string; jadwal_konsultasi?: { tanggal: string; waktu_mulai: string; konselor_id: string } };

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const toast = useToast();
  const now = useMemo(moment, []);

  const [journals, setJournals] = useState<any[]>([]);
  const [lastSession, setLastSession] = useState<{ session_id: string; title?: string } | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [counselors, setCounselors] = useState<Record<string, string>>({});
  const [savingMood, setSavingMood] = useState<Mood | null>(null);
  const [checkin, setCheckin] = useState<any | null>(null); // the entry saved by the quick check-in

  const load = useCallback(async () => {
    try {
      const res = await apiGetJournals(30, 0);
      setJournals(res.journals || []);
    } catch (err) {
      console.warn('Failed to load journals for home:', err);
      toast.show('Data jurnal belum bisa dimuat. Periksa koneksimu.', 'error');
    }
    // Secondary blocks: fail quietly, they simply don't render
    apiGetChatSessions().then((r) => setLastSession(r.sessions?.[0] ?? null)).catch(() => {});
    Promise.all([apiGetBookingSaya(), apiGetKonselor()])
      .then(([b, k]) => {
        setBookings(b.bookings as Booking[]);
        setCounselors(Object.fromEntries(k.users.map((u: any) => [u.user_id, u.nama])));
      })
      .catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Today's latest entry counts as today's check-in
  const todayEntry = useMemo(() => {
    const t = dayKey(new Date());
    return journals.find((j) => dayKey(new Date(j.created_at)) === t) ?? null;
  }, [journals]);
  // Latest quick check-in (journals come newest first)
  const lastCheckin = useMemo(() => journals.find((j) => j.content?.startsWith(CHECKIN_PREFIX)) ?? null, [journals]);
  const current = checkin ?? todayEntry;
  const currentMood = moodOf(current?.mood);

  const quickCheckin = async (m: Mood) => {
    if (savingMood || current?.mood === m) return;
    setSavingMood(m);
    const label = moodOf(m)!.label.toLowerCase();
    const content = `${CHECKIN_PREFIX} merasa ${label}.`;
    // Quick re-tap = correction of the recent check-in; a later mood change is kept as its own entry
    const existing = [checkin, lastCheckin].find((j) => j?.journal_id && Date.now() - new Date(j.created_at).getTime() < CORRECTION_MS);
    try {
      const res: any = existing
        ? await apiUpdateJournal(existing.journal_id, { content, mood: m })
        : await apiSaveJournal({ content, mood: m });
      setCheckin(res.journal ?? { ...existing, mood: m });
      toast.show(existing ? `Check-in diperbarui: ${label}.` : `Check-in tersimpan: ${label}.`);
      load();
    } catch (e: any) {
      toast.show(`Check-in belum tersimpan: ${e.message || 'coba lagi sebentar.'}`, 'error');
    } finally {
      setSavingMood(null);
    }
  };

  const openEntry = (j: any) =>
    router.push({ pathname: '/journal-detail', params: { journal_id: j.journal_id, content: j.content, mood: j.mood, created_at: j.created_at } });

  // Last 7 days ending today: dominant mood per day, streak, and a one-line reading
  const week = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const entries = journals.filter((j) => dayKey(new Date(j.created_at)) === dayKey(d) && j.mood);
      const tally: Record<string, number> = {};
      entries.forEach((j) => (tally[j.mood] = (tally[j.mood] || 0) + 1));
      const mood = (Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0] as Mood) ?? null;
      return { date: d, mood, isToday: i === 6 };
    });
    let streak = 0;
    const has = new Set(journals.map((j) => dayKey(new Date(j.created_at))));
    const cur = new Date(today);
    if (!has.has(dayKey(cur))) cur.setDate(cur.getDate() - 1);
    while (has.has(dayKey(cur))) { streak++; cur.setDate(cur.getDate() - 1); }

    const counts: Record<string, number> = {};
    days.forEach((d) => d.mood && (counts[d.mood] = (counts[d.mood] || 0) + 1));
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const top = ranked[0];
    const tie = ranked[1] && ranked[1][1] === top?.[1]; // no single dominant mood: don't pretend there is
    const heavy = days.filter((d) => d.mood === 'Anxious' || d.mood === 'Tired').map((d) => DAY_LONG[d.date.getDay()]);
    let insight = 'Belum ada check-in minggu ini. Satu ketukan di atas sudah cukup untuk mulai.';
    if (top) {
      insight = tie ? 'Suasana hatimu cukup beragam minggu ini.' : `${moodOf(top[0])!.label} paling sering muncul.`;
      if (heavy.length) insight += ` ${heavy.slice(0, 2).join(' dan ')} terasa lebih berat.`;
    }
    return { days, streak, insight };
  }, [journals]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const next = bookings
    .filter((b) => (b.status === 'menunggu' || b.status === 'dikonfirmasi') && (b.jadwal_konsultasi?.tanggal ?? '') >= todayStr)
    .sort((a, b) => `${a.jadwal_konsultasi!.tanggal}${a.jadwal_konsultasi!.waktu_mulai}`.localeCompare(`${b.jadwal_konsultasi!.tanggal}${b.jadwal_konsultasi!.waktu_mulai}`))[0];

  const firstName = user?.nama?.split(' ')[0];
  const initials = (user?.nama || 'S').split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase()).join('');
  const face: Expression = current?.mood ? MOOD_COMPANION[current.mood as Mood].face : now.face;

  const shortcuts = [
    { icon: 'book', label: 'Jurnal', color: TRI.sage, to: '/journal-history' },
    { icon: 'calendar', label: 'Konseling', color: TRI.amber, to: '/schedule' },
    { icon: 'stats-chart', label: 'Laporan', color: TRI.navy, to: '/stats' },
    { icon: 'call', label: 'Hotline', color: TRI.coral, to: '/hotline' },
  ];

  return (
    <View style={[s.root, { backgroundColor: TRI.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 124 }]}
      >
        {/* ── Header ── */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.date}>{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
              <Text style={s.greet} accessibilityRole="header" numberOfLines={2}>
                {now.greet}{firstName ? `, ${firstName}` : ''}
              </Text>
            </View>
            <PressableScale
              onPress={() => router.push('/profile')}
              accessibilityRole="button"
              accessibilityLabel="Profil"
              style={({ pressed }) => [s.avatar, { boxShadow: pressed ? triInset(0.5) : triRaised(0.5) }]}
            >
              <Text style={s.avatarText}>{initials}</Text>
            </PressableScale>
          </View>

        {/* ── Hero: talk now, or pick up where you left off ── */}
          <View style={[s.hero, { boxShadow: triRaised(1) }]}>
            <View style={s.heroTop}>
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={s.heroKicker}>Sajiwa siap mendengarkan</Text>
                <Text style={s.heroTitle}>{now.ask}</Text>
              </View>
              {/* Neumorphism on navy: shadows are navy tints, not grey */}
              <View style={s.heroStage}>
                <View style={s.heroWell}>
                  <Companion expression={face} size={118} />
                </View>
              </View>
            </View>
            <PressableScale
              onPress={() => router.push('/chat')}
              accessibilityRole="button"
              style={({ pressed }) => [s.heroCta, pressed && { transform: [{ scale: 0.98 }] }]}
            >
              <Ionicons name="chatbubble-ellipses" size={18} color={TRI.navy} />
              <Text style={s.heroCtaText}>Mulai cerita baru</Text>
              <Ionicons name="arrow-forward" size={18} color={TRI.navy} />
            </PressableScale>
            {lastSession && (
              <PressableScale
                onPress={() => router.push(`/chat?sessionId=${lastSession.session_id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Lanjutkan percakapan: ${lastSession.title || 'percakapan terakhir'}`}
                style={s.resume}
              >
                <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.85)" />
                <Text style={s.resumeText} numberOfLines={1}>
                  Lanjutkan: <Text style={s.resumeTitle}>{lastSession.title || 'percakapan terakhir'}</Text>
                </Text>
              </PressableScale>
            )}
          </View>

        {/* ── One-tap check-in (journal = sage) ── */}
          <View style={{ gap: 14 }}>
            <View style={s.rowBetween}>
              <Text style={s.section} accessibilityRole="header">Check-in cepat</Text>
              <PressableScale onPress={() => router.push('/journal')} hitSlop={10} accessibilityRole="link">
                <Text style={[s.link, { color: TRI.sage }]}>Tulis jurnal</Text>
              </PressableScale>
            </View>
            <View style={s.moodRow} accessibilityRole="radiogroup">
              {MOODS.map((m) => {
                const active = current?.mood === m.key;
                const saving = savingMood === m.key;
                return (
                  <PressableScale
                    key={m.key}
                    onPress={() => quickCheckin(m.key)}
                    disabled={!!savingMood}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active, busy: saving }}
                    accessibilityLabel={`Check-in ${m.label}`}
                    style={({ pressed }) => [s.moodKey, { boxShadow: active || pressed ? triInset(0.8) : triRaised(0.55) }]}
                  >
                    <View style={[s.moodIcon, { backgroundColor: active ? m.color : m.color + '1F' }]}>
                      {saving ? (
                        <ActivityIndicator size="small" color={m.color} />
                      ) : (
                        <Ionicons name={m.icon.replace('-outline', '') as any} size={20} color={active ? '#fff' : m.color} />
                      )}
                    </View>
                    <Text
                      style={[s.moodLabel, { color: active ? m.color : TRI.sub, fontFamily: active ? 'PlusJakartaSans_800ExtraBold' : 'PlusJakartaSans_600SemiBold' }]}
                    >
                      {m.label}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
            {current && currentMood && (
              <PressableScale onPress={() => openEntry(current)} accessibilityRole="button" style={[s.note, { backgroundColor: TRI.sageFill }]}>
                <Ionicons name="leaf" size={16} color={TRI.sage} />
                <Text style={[s.noteText, { color: TRI.sage }]}>
                  Tercatat hari ini: {currentMood.label.toLowerCase()}. Mau tambah satu kalimat?
                </Text>
                <Ionicons name="chevron-forward" size={16} color={TRI.sage} />
              </PressableScale>
            )}
          </View>

        {/* ── This week at a glance ── */}
          <View style={[s.card, { boxShadow: triRaised(0.8) }]}>
            <View style={s.rowBetween}>
              <Text style={s.section} accessibilityRole="header">Minggu ini</Text>
              {week.streak > 1 && (
                <View style={s.streak}>
                  <Ionicons name="flame" size={14} color={TRI.amber} />
                  <Text style={[s.streakText, { color: TRI.amber }]}>{week.streak} hari beruntun</Text>
                </View>
              )}
            </View>
            <View
              style={s.week}
              accessible
              accessibilityLabel={'Suasana hati 7 hari: ' + week.days.map((d) => `${DAY_LONG[d.date.getDay()]} ${moodOf(d.mood)?.label ?? 'kosong'}`).join(', ')}
            >
              {week.days.map((d, i) => {
                const m = moodOf(d.mood);
                return (
                  <View key={i} style={s.weekCol}>
                    <View
                      style={[
                        s.weekDot,
                        { backgroundColor: m ? m.color : 'rgba(122,134,168,0.18)' },
                        d.isToday && { borderWidth: 2.5, borderColor: TRI.ink },
                      ]}
                    >
                      {m && <Ionicons name={m.icon.replace('-outline', '') as any} size={14} color="#fff" />}
                    </View>
                    <Text style={[s.weekDay, d.isToday && { color: TRI.ink, fontFamily: 'PlusJakartaSans_800ExtraBold' }]}>
                      {d.isToday ? 'Ini' : DAY_SHORT[d.date.getDay()]}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Text style={s.insight}>{week.insight}</Text>
            <PressableScale onPress={() => router.push('/stats')} accessibilityRole="link" style={s.inlineLink}>
              <Text style={[s.link, { color: TRI.navy }]}>Lihat laporan lengkap</Text>
              <Ionicons name="arrow-forward" size={14} color={TRI.navy} />
            </PressableScale>
          </View>

        {/* ── Next counseling session (amber), only when there is one ── */}
        {next?.jadwal_konsultasi && (
            <PressableScale
              onPress={() => router.push('/schedule')}
              accessibilityRole="button"
              style={({ pressed }) => [s.session, { boxShadow: pressed ? triInset(0.7) : triRaised(0.8) }]}
            >
              <View style={[s.sessionDate, { backgroundColor: TRI.amberFill }]}>
                <Text style={s.sessionDay}>{new Date(next.jadwal_konsultasi.tanggal).getDate()}</Text>
                <Text style={s.sessionMonth}>
                  {new Date(next.jadwal_konsultasi.tanggal).toLocaleDateString('id-ID', { month: 'short' })}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[s.sessionKicker, { color: TRI.amber }]}>Sesi konseling berikutnya</Text>
                <Text style={s.sessionName} numberOfLines={1}>{counselors[next.jadwal_konsultasi.konselor_id] ?? 'Konselor kampus'}</Text>
                <Text style={s.sessionMeta}>
                  {DAY_LONG[new Date(next.jadwal_konsultasi.tanggal).getDay()]}, {hm(next.jadwal_konsultasi.waktu_mulai)} ·{' '}
                  {next.status === 'dikonfirmasi' ? 'dikonfirmasi' : 'menunggu konfirmasi'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={TRI.muted} />
            </PressableScale>
        )}

        {/* ── Shortcuts: the core color says which part of the app it opens ── */}
          <View style={s.shortcuts}>
            {shortcuts.map((it) => (
              <PressableScale key={it.label} onPress={() => router.push(it.to as any)} accessibilityRole="button" accessibilityLabel={it.label} style={s.shortcut}>
                {({ pressed }) => (
                  <>
                    <View style={[s.knob, { boxShadow: pressed ? triInset(0.6) : triRaised(0.6) }]}>
                      <View style={[s.knobCore, { backgroundColor: it.color }]}>
                        <Ionicons name={it.icon as any} size={20} color="#fff" />
                      </View>
                    </View>
                    <Text style={s.knobLabel}>{it.label}</Text>
                  </>
                )}
              </PressableScale>
            ))}
          </View>

        {/* ── Affirmation, quiet ── */}
          <View style={s.quote}>
            <Text style={s.quoteMark}>“</Text>
            <Text style={s.quoteText}>Tidak apa-apa untuk beristirahat. Bunga pun butuh waktu untuk mekar kembali.</Text>
          </View>
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 22, gap: 26 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  date: { fontSize: 13, color: TRI.sub, fontFamily: 'PlusJakartaSans_600SemiBold', textTransform: 'capitalize' },
  greet: { fontSize: 27, color: TRI.ink, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.7, lineHeight: 34 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: TRI.bg, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: TRI.navy, fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold' },

  hero: { backgroundColor: TRI.navy, borderRadius: 30, padding: 20, gap: 14, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroKicker: { color: 'rgba(255,255,255,0.78)', fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold' },
  heroTitle: { color: '#fff', fontSize: 23, lineHeight: 30, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.5 },
  heroStage: {
    width: 142, height: 142, borderRadius: 71, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center',
  },
  heroWell: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: TRI.navyDeep, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end',
    boxShadow: 'inset 5px 5px 10px rgba(8,14,40,0.6), inset -4px -4px 10px rgba(255,255,255,0.08)',
  },
  heroCta: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, borderRadius: 27, paddingHorizontal: 20,
    backgroundColor: '#EEF1F7', boxShadow: '4px 6px 14px rgba(8,14,40,0.35)',
  },
  heroCtaText: { flex: 1, color: TRI.navy, fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  resume: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, minHeight: 32 },
  resumeText: { flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium' },
  resumeTitle: { fontFamily: 'PlusJakartaSans_700Bold', color: '#fff' },

  section: { color: TRI.ink, fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.3 },
  link: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },
  inlineLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 32 },

  moodRow: { flexDirection: 'row', gap: 12 },
  moodKey: { flex: 1, backgroundColor: TRI.bg, borderRadius: 22, paddingVertical: 14, alignItems: 'center', gap: 8 },
  moodIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  moodLabel: { fontSize: 13 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16 },
  noteText: { flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', lineHeight: 19 },

  card: { backgroundColor: TRI.bg, borderRadius: 26, padding: 18, gap: 14 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streakText: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold' },
  week: { flexDirection: 'row' },
  weekCol: { flex: 1, alignItems: 'center', gap: 8 },
  weekDot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  weekDay: { fontSize: 12, color: TRI.sub, fontFamily: 'PlusJakartaSans_600SemiBold' },
  insight: { fontSize: 14, color: TRI.sub, fontFamily: 'PlusJakartaSans_500Medium', lineHeight: 21 },

  session: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: TRI.bg, borderRadius: 24, padding: 14 },
  sessionDate: { width: 58, height: 62, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sessionDay: { color: TRI.ink, fontSize: 23, lineHeight: 27, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  sessionMonth: { color: TRI.ink, fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold' },
  sessionKicker: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold' },
  sessionName: { color: TRI.ink, fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  sessionMeta: { color: TRI.sub, fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium' },

  shortcuts: { flexDirection: 'row' },
  shortcut: { flex: 1, alignItems: 'center', gap: 8 },
  knob: { width: 62, height: 62, borderRadius: 31, backgroundColor: TRI.bg, alignItems: 'center', justifyContent: 'center' },
  knobCore: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  knobLabel: { fontSize: 13, color: TRI.ink, fontFamily: 'PlusJakartaSans_700Bold' },

  quote: { backgroundColor: TRI.sageFill, borderRadius: 22, padding: 18, flexDirection: 'row', gap: 10 },
  quoteMark: { fontSize: 40, lineHeight: 40, color: TRI.sage, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  quoteText: { flex: 1, fontSize: 15, lineHeight: 23, color: TRI.sub, fontFamily: 'PlusJakartaSans_600SemiBold' },
});
