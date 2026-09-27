import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav, FadeIn, NeuView, Button, IconButton, useToast } from '../components/ui';
import { Companion } from '../components/chat';
import { MoodPicker } from '../components/MoodPicker';
import { useTheme, useAuth, Neu, Spacing } from '@prototype/ui-shared';
import { apiSaveJournal, apiGetJournals } from '@prototype/api-client';
import type { Expression } from '@prototype/utils';
import { MOODS, Mood, moodColor, MOOD_COMPANION } from '../constants/moods';

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
};

// Companion's opening face follows the time of day
const timeFace = (): Expression => {
  const h = new Date().getHours();
  if (h < 11) return 'semangat';
  if (h < 18) return 'menyapa';
  if (h < 22) return 'senang';
  return 'mengantuk';
};


const formatDate = () =>
  new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [journalText, setJournalText] = useState('');
  const [isSavingJournal, setIsSavingJournal] = useState(false);
  const [journals, setJournals] = useState<any[]>([]);
  const [face, setFace] = useState<Expression>(timeFace);

  const fetchJournals = useCallback(async () => {
    try {
      const res = await apiGetJournals(30, 0);
      setJournals(res.journals || []);
    } catch (err) {
      console.warn('Failed to load journals for home:', err);
      toast.show('Data jurnal belum bisa dimuat. Periksa koneksimu.', 'error');
    }
  }, []);

  useEffect(() => {
    fetchJournals();
  }, [fetchJournals]);

  const pickMood = (m: Mood) => {
    setSelectedMood(m);
    setFace(MOOD_COMPANION[m].face);
  };

  const handleSaveJournal = async () => {
    if (!journalText.trim() || !selectedMood) {
      toast.show('Pilih suasana hati dan tulis sedikit dulu, ya.', 'info');
      return;
    }
    setIsSavingJournal(true);
    try {
      await apiSaveJournal({ content: journalText, mood: selectedMood });
      toast.show('Jurnal tersimpan.');
      setJournalText('');
      setSelectedMood(null);
      setFace('jempol');
      await fetchJournals();
    } catch (err: any) {
      toast.show(`Jurnal belum tersimpan: ${err.message || 'coba lagi sebentar.'}`, 'error');
    } finally {
      setIsSavingJournal(false);
    }
  };

  const weeklyData = useMemo(() => {
    const daysShort = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const today = new Date();
    const daysList = [];
    const counts: Record<string, number> = { Calm: 0, Focused: 0, Tired: 0, Anxious: 0 };
    let totalRecorded = 0;

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const isToday = i === 0;

      const dayJournals = journals.filter((j: any) => j.created_at?.startsWith(dateStr));
      let dominantMood: Mood | null = null;
      let score = 0;

      if (dayJournals.length > 0) {
        const dayCounts: Record<string, number> = {};
        dayJournals.forEach((j: any) => {
          if (j.mood) {
            dayCounts[j.mood] = (dayCounts[j.mood] || 0) + 1;
            if (counts[j.mood] !== undefined) {
              counts[j.mood]++;
              totalRecorded++;
            }
          }
        });
        dominantMood = Object.keys(dayCounts).sort((a, b) => dayCounts[b] - dayCounts[a])[0] as any;
        if (dominantMood === 'Calm') score = 95;
        else if (dominantMood === 'Focused') score = 80;
        else if (dominantMood === 'Tired') score = 55;
        else if (dominantMood === 'Anxious') score = 35;
      }

      daysList.push({ dayName: isToday ? 'Hari ini' : daysShort[d.getDay()], isToday, mood: dominantMood, score });
    }

    let dominantTendency = 'Belum ada data';
    let tendencyColor = colors.primary;
    let tendencyIcon: any = 'leaf-outline';
    let tendencyInsight = 'Mulai catat perasaanmu di jurnal harian di atas untuk melihat dinamika emosimu.';

    if (totalRecorded > 0) {
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] > 0) {
        tendencyColor = moodColor(top[0])!;
        if (top[0] === 'Calm') {
          dominantTendency = 'Cenderung tenang';
          tendencyIcon = 'leaf-outline';
          tendencyInsight = 'Kondisi emosimu cenderung stabil dan damai dalam 7 hari ini. Teruskan ritme positif ini!';
        } else if (top[0] === 'Focused') {
          dominantTendency = 'Fokus & terarah';
          tendencyIcon = 'disc-outline';
          tendencyInsight = 'Pikiranmu produktif dan jernih. Jangan lupa sisihkan waktu rehat di sela aktivitas.';
        } else if (top[0] === 'Tired') {
          dominantTendency = 'Cenderung lelah';
          tendencyIcon = 'battery-half-outline';
          tendencyInsight = 'Ada tanda kelelahan fisik/mental yang terkumpul. Prioritaskan tidur cukup malam ini.';
        } else if (top[0] === 'Anxious') {
          dominantTendency = 'Cenderung cemas';
          tendencyIcon = 'cloud-outline';
          tendencyInsight = 'Kecemasanmu sedang meningkat. Coba latihan napas atau ceritakan ke Sajiwa.';
        }
      }
    }

    return { daysList, counts, totalRecorded, dominantTendency, tendencyColor, tendencyIcon, tendencyInsight };
  }, [journals, colors]);

  const navItems = [
    { icon: 'time-outline', label: 'Riwayat Chat', route: '/chat-history' },
    { icon: 'book-outline', label: 'Jurnal', route: '/journal-history' },
    { icon: 'stats-chart-outline', label: 'Laporan', route: '/stats' },
    { icon: 'call-outline', label: 'Hotline', route: '/hotline' },
  ];

  const canSave = !!journalText.trim() && !!selectedMood;
  const chartLabel =
    'Grafik suasana hati 7 hari: ' +
    weeklyData.daysList
      .map((d) => d.dayName + ' ' + (MOODS.find((m) => m.key === d.mood)?.label ?? 'tidak ada catatan'))
      .join(', ');

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 }]}
      >
        {/* ── Header: greeting + avatar, then this week's mood strip ── */}
        <FadeIn delay={0}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={[s.greetDate, { color: colors.onSurfaceVariant }]}>{formatDate()}</Text>
              <Text style={[s.greetTitle, { color: colors.onSurface }]} accessibilityRole="header" numberOfLines={2}>
                {getGreeting()}{user?.nama ? `, ${user.nama.split(' ')[0]}` : ''}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/profile')}
              accessibilityRole="button"
              accessibilityLabel="Profil"
              style={({ pressed }) => [s.navAvatar, { backgroundColor: colors.background, boxShadow: pressed ? Neu.inset : Neu.raisedSm }]}
            >
              <Text style={[s.navAvatarText, { color: colors.primary }]}>
                {user?.nama?.trim()?.[0]?.toUpperCase() ?? 'S'}
              </Text>
            </Pressable>
          </View>

          <NeuView inset radius={20} style={s.weekStrip}>
            <View style={s.weekHead}>
              <Text style={[s.weekTitle, { color: colors.onSurface }]}>Minggu ini</Text>
              <Text style={[s.weekMeta, { color: colors.onSurfaceVariant }]}>
                {weeklyData.totalRecorded > 0 ? `${weeklyData.totalRecorded} check-in` : 'Belum ada check-in'}
              </Text>
            </View>
            <View style={s.weekDays} accessible accessibilityLabel={chartLabel}>
              {weeklyData.daysList.map((d, i) => (
                <View key={i} style={s.weekDay}>
                  <View
                    style={[
                      s.weekDot,
                      d.mood
                        ? { backgroundColor: moodColor(d.mood) }
                        : { backgroundColor: colors.background, boxShadow: Neu.raisedSm },
                      d.isToday && { borderWidth: 2, borderColor: colors.primary },
                    ]}
                  >
                    {d.mood && <Ionicons name={MOODS.find((m) => m.key === d.mood)!.icon} size={14} color="#fff" />}
                  </View>
                  <Text
                    style={[
                      s.weekLabel,
                      {
                        color: d.isToday ? colors.primary : colors.onSurfaceVariant,
                        fontFamily: d.isToday ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_500Medium',
                      },
                    ]}
                  >
                    {d.dayName}
                  </Text>
                </View>
              ))}
            </View>
          </NeuView>
        </FadeIn>

        {/* ── Main CTA with the companion peeking in ── */}
        <FadeIn delay={80}>
          <Pressable
            onPress={() => router.push('/chat')}
            accessibilityRole="button"
            accessibilityLabel="Mulai cerita dengan Sajiwa"
            style={({ pressed }) => [
              s.dialogCard,
              { backgroundColor: colors.primary, boxShadow: Neu.raised },
              pressed && { transform: [{ scale: 0.98 }] },
            ]}
          >
            <View style={s.dialogBlobLarge} />
            <View style={s.dialogBlobSmall} />
            <View style={s.dialogText}>
              <Text style={s.dialogTitle}>Mulai cerita</Text>
              <Text style={s.dialogDesc}>Sajiwa siap mendengarkan kapan saja, tanpa menghakimi.</Text>
              <View style={[s.dialogBtn, { backgroundColor: colors.background }]}>
                <Text style={[s.dialogBtnText, { color: colors.primary }]}>Mulai percakapan</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.primary} />
              </View>
            </View>
            <View style={s.dialogCompanion}>
              <Companion expression={face} size={156} interactive={false} />
            </View>
          </Pressable>
        </FadeIn>

        {/* ── Quick links ── */}
        <FadeIn delay={160}>
          <View style={s.navIconsRow}>
            {navItems.map((item) => (
              <Pressable
                key={item.route}
                onPress={() => router.push(item.route as any)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                style={({ pressed }) => [
                  s.navIconBtn,
                  { backgroundColor: colors.background, boxShadow: pressed ? Neu.inset : Neu.raisedSm },
                ]}
              >
                <Ionicons
                  name={item.icon as any}
                  size={22}
                  color={item.route === '/hotline' ? colors.stressHigh : colors.primary}
                />
                <Text style={[s.navIconLabel, { color: colors.onSurface }]} numberOfLines={2}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </FadeIn>

        {/* ── Daily journal ── */}
        <FadeIn delay={240}>
          <NeuView radius={24} style={s.card}>
            <View style={s.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[s.cardTitle, { color: colors.onSurface }]} accessibilityRole="header">Jurnal harian</Text>
                <Text style={[s.cardSub, { color: colors.onSurfaceVariant }]}>
                  Jernihkan pikiranmu lewat tulisan singkat.
                </Text>
              </View>
              <IconButton icon="expand-outline" label="Buka editor jurnal lengkap" color={colors.primary} onPress={() => router.push('/journal')} />
            </View>

            <Text style={[s.fieldLabel, { color: colors.onSurface }]}>Suasana hati</Text>
            <MoodPicker value={selectedMood} onChange={pickMood} />

            <NeuView inset radius={18}>
              <TextInput
                style={[s.journalInput, { color: colors.onSurface }]}
                placeholderTextColor={colors.textMuted}
                placeholder="Apa yang sedang kamu pikirkan?"
                accessibilityLabel="Isi jurnal"
                multiline
                textAlignVertical="top"
                value={journalText}
                onChangeText={setJournalText}
              />
            </NeuView>

            <Button label="Simpan jurnal" onPress={handleSaveJournal} loading={isSavingJournal} disabled={!canSave} />
            {!canSave && (
              <Text style={[s.hint, { color: colors.textMuted }]}>
                Pilih suasana hati dan tulis sedikit untuk menyimpan.
              </Text>
            )}
          </NeuView>
        </FadeIn>

        {/* ── Affirmation ── */}
        <FadeIn delay={280}>
          <NeuView inset radius={24} style={s.quoteCard}>
            <Ionicons name="sparkles-outline" size={20} color={colors.primary} />
            <Text style={[s.quoteText, { color: colors.onSurface }]}>
              Tidak apa-apa untuk beristirahat. Bunga pun butuh waktu untuk mekar kembali.
            </Text>
          </NeuView>
        </FadeIn>

        {/* ── Mood trend ── */}
        <FadeIn delay={320}>
          <NeuView radius={24} style={s.card}>
            <View>
              <Text style={[s.cardTitle, { color: colors.onSurface }]} accessibilityRole="header">7 hari terakhir</Text>
              <Text style={[s.cardSub, { color: colors.onSurfaceVariant }]}>
                {weeklyData.totalRecorded > 0 ? `${weeklyData.totalRecorded} catatan minggu ini` : 'Belum ada catatan'}
              </Text>
            </View>

            <NeuView inset radius={18} style={s.insightBox}>
              <Ionicons name={weeklyData.tendencyIcon} size={22} color={weeklyData.tendencyColor} />
              <View style={{ flex: 1 }}>
                <Text style={[s.insightTitle, { color: weeklyData.tendencyColor }]}>{weeklyData.dominantTendency}</Text>
                <Text style={[s.insightDesc, { color: colors.onSurfaceVariant }]}>{weeklyData.tendencyInsight}</Text>
              </View>
            </NeuView>

            <View style={s.barsContainer} accessible accessibilityLabel={chartLabel}>
              {weeklyData.daysList.map((item, idx) => {
                const hasData = item.mood !== null;
                const barHeight = hasData ? Math.max(20, (item.score / 100) * 72) : 0;
                return (
                  <View key={idx} style={s.barCol}>
                    <View style={[s.barTrack, { backgroundColor: colors.background, boxShadow: Neu.inset }]}>
                      {hasData && <View style={[s.barFill, { height: barHeight, backgroundColor: moodColor(item.mood) }]} />}
                    </View>
                    <Text
                      style={[
                        s.barDayLabel,
                        {
                          color: item.isToday ? colors.primary : colors.onSurfaceVariant,
                          fontFamily: item.isToday ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_500Medium',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {item.dayName}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={s.breakdownRow}>
              {MOODS.map((m) => (
                <View key={m.key} style={s.breakdownItem}>
                  <View style={[s.miniColorDot, { backgroundColor: m.color }]} />
                  <Text style={[s.breakdownText, { color: colors.onSurfaceVariant }]}>
                    {m.label} {weeklyData.counts[m.key] || 0}
                  </Text>
                </View>
              ))}
            </View>

            <Button
              variant="secondary"
              label="Lihat laporan lengkap"
              onPress={() => router.push('/stats')}
              icon={<Ionicons name="stats-chart-outline" size={16} color={colors.primary} />}
            />
          </NeuView>
        </FadeIn>
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.lg, gap: Spacing.xl },

  navAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  navAvatarText: { fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  greetDate: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold' },
  greetTitle: { fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.7, lineHeight: 32 },

  weekStrip: { padding: 14, gap: 12 },
  weekHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2 },
  weekTitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },
  weekMeta: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium' },
  weekDays: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { alignItems: 'center', gap: 6, flex: 1 },
  weekDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  weekLabel: { fontSize: 12 },

  // Dialogue CTA: text on the left, companion standing on the card's bottom edge on the right
  dialogCard: {
    borderRadius: 28,
    paddingLeft: 24,
    paddingTop: 24,
    flexDirection: 'row',
    alignItems: 'flex-end',
    overflow: 'hidden',
  },
  dialogBlobLarge: {
    position: 'absolute',
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -70, right: -50,
  },
  dialogBlobSmall: {
    position: 'absolute',
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.05)',
    bottom: -40, left: 120,
  },
  dialogText: { flex: 1, gap: 8, paddingBottom: 24, minWidth: 0 },
  dialogTitle: { fontSize: 24, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#ffffff', letterSpacing: -0.5 },
  dialogDesc: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: 'rgba(255,255,255,0.88)', lineHeight: 21 },
  dialogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  dialogBtnText: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },
  dialogCompanion: { marginBottom: -18, marginRight: -14, marginLeft: -12 },

  navIconsRow: { flexDirection: 'row', gap: 12 },
  navIconBtn: {
    flex: 1,
    minHeight: 88,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 8,
  },
  navIconLabel: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', textAlign: 'center' },

  card: { padding: 20, gap: 16 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardTitle: { fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.3 },
  cardSub: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 20, marginTop: 2 },
  fieldLabel: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: -4 },
  hint: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', textAlign: 'center', marginTop: -6 },

  journalInput: { minHeight: 120, padding: 16, fontSize: 15, lineHeight: 22, fontFamily: 'PlusJakartaSans_400Regular' },

  quoteCard: { padding: 20, gap: 10 },
  quoteText: { fontSize: 16, fontFamily: 'PlusJakartaSans_600SemiBold', lineHeight: 25 },

  insightBox: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 12 },
  insightTitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 2 },
  insightDesc: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 20 },
  barsContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 4 },
  barCol: { flex: 1, alignItems: 'center', gap: 8 },
  barTrack: { width: 22, height: 80, borderRadius: 11, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 11 },
  barDayLabel: { fontSize: 12 },
  breakdownRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' },
  breakdownItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  miniColorDot: { width: 8, height: 8, borderRadius: 4 },
  breakdownText: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium' },
});
