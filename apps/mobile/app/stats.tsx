import React, { useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { apiGetJournals } from '@prototype/api-client';

import { BottomNav, FadeIn, NeuView, Button, ScreenHeader, IconButton, useToast } from '../components/ui';
import { useTheme, Neu } from '@prototype/ui-shared';
import { MOODS, Mood, moodOf } from '../constants/moods';

type Day = { day: string; score: number; mood: Mood | null };

const INIT_WEEK: Day[] = Array(7).fill({ day: '-', score: 0, mood: null });
const CHART_H = 100;
const SCORE: Record<string, number> = { Calm: 100, Focused: 80, Tired: 50, Anxious: 30 };

// weekOffset: 0 = minggu ini, -1 = minggu lalu, dst.
function getWeekRange(weekOffset: number) {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 6 + weekOffset * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(today.getDate() + weekOffset * 7);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatWeekLabel(weekOffset: number) {
  if (weekOffset === 0) return '7 hari terakhir';
  if (weekOffset === -1) return 'Minggu lalu';
  const { start, end } = getWeekRange(weekOffset);
  const fmt = (d: Date) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const toast = useToast();

  const [weekOffset, setWeekOffset] = React.useState(0);
  const [allJournals, setAllJournals] = React.useState<any[]>([]);
  const [weekData, setWeekData] = React.useState<Day[]>(INIT_WEEK);
  const [counts, setCounts] = React.useState<Record<Mood, number>>({ Calm: 0, Focused: 0, Tired: 0, Anxious: 0 });
  const [total, setTotal] = React.useState(0);
  const barAnims = useRef(INIT_WEEK.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    apiGetJournals(200, 0)
      .then((res) => setAllJournals(res.journals || []))
      .catch((e) => {
        console.error(e);
        toast.show('Data laporan belum bisa dimuat. Coba lagi nanti.', 'error');
      });
  }, []);

  const computeStats = useCallback(() => {
    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const today = new Date();
    const next: Day[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i + weekOffset * 7);
      const dateStr = d.toISOString().split('T')[0];
      const dayJournals = allJournals.filter((j: any) => j.created_at.startsWith(dateStr));

      let score = 0;
      let mood: Mood | null = null;
      if (dayJournals.length > 0) {
        score = Math.round(dayJournals.reduce((a: number, j: any) => a + (SCORE[j.mood] ?? 70), 0) / dayJournals.length);
        const tally: Record<string, number> = {};
        dayJournals.forEach((j: any) => j.mood && (tally[j.mood] = (tally[j.mood] || 0) + 1));
        mood = (Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0] as Mood) ?? null;
      }
      next.push({ day: days[d.getDay()], score, mood });
    }
    setWeekData(next);

    const { start, end } = getWeekRange(weekOffset);
    const period = allJournals.filter((j: any) => {
      const d = new Date(j.created_at);
      return d >= start && d <= end;
    });
    const c: Record<Mood, number> = { Calm: 0, Focused: 0, Tired: 0, Anxious: 0 };
    period.forEach((j: any) => { if (j.mood in c) c[j.mood as Mood]++; });
    setCounts(c);
    setTotal(period.length);

    barAnims.forEach((a) => a.setValue(0));
    Animated.parallel(
      barAnims.map((anim, idx) =>
        Animated.timing(anim, { toValue: next[idx].score / 100, duration: 500, delay: 60 * idx, useNativeDriver: false }),
      ),
    ).start();
  }, [allJournals, weekOffset]);

  useEffect(() => {
    computeStats();
  }, [computeStats]);

  const dominant = React.useMemo(() => {
    const top = (Object.entries(counts) as [Mood, number][]).sort((a, b) => b[1] - a[1])[0];
    return top && top[1] > 0 ? moodOf(top[0]) : undefined;
  }, [counts]);

  const recommendation = React.useMemo(() => {
    switch (dominant?.key) {
      case 'Anxious':
        return {
          title: 'Tenangkan pikiranmu',
          text: 'Kecemasanmu cukup sering muncul pekan ini. Coba perlambat ritme harimu dan ceritakan apa yang kamu rasakan.',
          btn: 'Cerita ke Sajiwa', to: '/chat', icon: 'chatbubble-ellipses-outline',
        };
      case 'Tired':
        return {
          title: 'Pulihkan energimu',
          text: 'Kamu sering merasa lelah pekan ini. Coba tidur lebih awal atau lakukan aktivitas ringan seperti jalan santai.',
          btn: 'Cerita ke Sajiwa', to: '/chat', icon: 'moon-outline',
        };
      case 'Focused':
        return {
          title: 'Fokus dan produktif',
          text: 'Pekan ini kamu cukup fokus. Jaga stamina mental dengan jeda singkat 5 menit di sela aktivitas.',
          btn: 'Refleksi dengan Sajiwa', to: '/chat', icon: 'disc-outline',
        };
      case 'Calm':
        return {
          title: 'Pertahankan ketenanganmu',
          text: 'Kondisimu cenderung stabil pekan ini. Luangkan waktu untuk bersantai dan bersyukur setiap hari.',
          btn: 'Tulis jurnal', to: '/journal', icon: 'leaf-outline',
        };
      default:
        return {
          title: 'Mulai menulis jurnal',
          text: 'Belum ada jurnal di periode ini. Catat perasaanmu untuk melihat polanya di sini.',
          btn: 'Tulis jurnal sekarang', to: '/journal', icon: 'book-outline',
        };
    }
  }, [dominant]);

  const chartLabel =
    'Grafik suasana hati: ' +
    weekData.map((d) => d.day + ' ' + (moodOf(d.mood)?.label ?? 'tidak ada catatan')).join(', ');

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 }]}
      >
        <ScreenHeader
          back
          title="Laporan mingguan"
          subtitle="Pola suasana hati dari jurnalmu."
          right={<IconButton icon="time-outline" label="Riwayat jurnal" color={colors.primary} onPress={() => router.push('/journal-history')} />}
        />

        {/* Week navigator */}
        <FadeIn>
          <NeuView radius={22} style={s.weekNav}>
            <IconButton icon="chevron-back" label="Minggu sebelumnya" color={colors.primary} onPress={() => setWeekOffset((p) => p - 1)} />
            <View style={s.weekNavCenter}>
              <Text style={[s.weekNavLabel, { color: colors.onSurface }]}>{formatWeekLabel(weekOffset)}</Text>
              {weekOffset < 0 && (
                <Text
                  style={[s.weekNavBack, { color: colors.primary }]}
                  onPress={() => setWeekOffset(0)}
                  accessibilityRole="button"
                >
                  Kembali ke minggu ini
                </Text>
              )}
            </View>
            <IconButton
              icon="chevron-forward"
              label="Minggu berikutnya"
              color={weekOffset >= 0 ? colors.textMuted : colors.primary}
              onPress={() => weekOffset < 0 && setWeekOffset((p) => p + 1)}
              style={weekOffset >= 0 ? { opacity: 0.5 } : undefined}
            />
          </NeuView>
        </FadeIn>

        {/* Overview: counts, not a pseudo-clinical score */}
        <FadeIn>
          <View style={[s.overviewCard, { backgroundColor: colors.primary, boxShadow: Neu.raised }]}>
            <View style={s.overviewBlob} />
            <Text style={s.overviewValue}>{total}</Text>
            <Text style={s.overviewLabel}>catatan jurnal</Text>
            <Text style={s.overviewSub}>
              {dominant ? `Paling sering merasa ${dominant.label.toLowerCase()}` : 'Belum ada catatan di periode ini'}
            </Text>
          </View>
        </FadeIn>

        {/* Daily chart */}
        <FadeIn>
          <NeuView radius={24} style={s.card}>
            <Text style={[s.sectionLabel, { color: colors.onSurface }]}>Suasana hati harian</Text>
            <View style={s.chart} accessible accessibilityLabel={chartLabel}>
              {weekData.map((d, i) => (
                <View key={i} style={s.barContainer}>
                  <View style={[s.barTrack, { backgroundColor: colors.background, boxShadow: Neu.inset }]}>
                    <Animated.View
                      style={[
                        s.barFill,
                        {
                          backgroundColor: moodOf(d.mood)?.color ?? 'transparent',
                          height: barAnims[i].interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                        },
                      ]}
                    />
                  </View>
                  <Text style={[s.barDay, { color: colors.onSurfaceVariant }]}>{d.day}</Text>
                </View>
              ))}
            </View>
          </NeuView>
        </FadeIn>

        {/* Distribution */}
        <FadeIn>
          <NeuView radius={24} style={s.card}>
            <Text style={[s.sectionLabel, { color: colors.onSurface }]}>Distribusi suasana hati</Text>
            {total === 0 ? (
              <Text style={[s.emptyText, { color: colors.onSurfaceVariant }]}>Tidak ada jurnal di periode ini.</Text>
            ) : (
              <View style={{ gap: 18 }}>
                {MOODS.map((m) => {
                  const count = counts[m.key];
                  const pct = (count / total) * 100;
                  return (
                    <View key={m.key} style={s.distRow} accessible accessibilityLabel={`${m.label}, ${count} kali`}>
                      <Ionicons name={m.icon} size={20} color={m.color} />
                      <View style={{ flex: 1, gap: 6 }}>
                        <View style={s.distMeta}>
                          <Text style={[s.distLabel, { color: colors.onSurface }]}>{m.label}</Text>
                          <Text style={[s.distCount, { color: m.color }]}>{count}×</Text>
                        </View>
                        <View style={[s.distTrack, { backgroundColor: colors.background, boxShadow: Neu.inset }]}>
                          <View style={[s.distFill, { backgroundColor: m.color, width: `${pct}%` }]} />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </NeuView>
        </FadeIn>

        {/* Recommendation */}
        <FadeIn>
          <NeuView radius={24} style={[s.card, { gap: 12 }]}>
            <View style={s.recHeader}>
              <Ionicons name={recommendation.icon as any} size={20} color={colors.primary} />
              <Text style={[s.recTitle, { color: colors.onSurface }]}>{recommendation.title}</Text>
            </View>
            <Text style={[s.recText, { color: colors.onSurfaceVariant }]}>{recommendation.text}</Text>
            <Button label={recommendation.btn} onPress={() => router.push(recommendation.to as any)} style={{ marginTop: 4 }} />
          </NeuView>
        </FadeIn>
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 20 },

  weekNav: { flexDirection: 'row', alignItems: 'center', padding: 8 },
  weekNavCenter: { flex: 1, alignItems: 'center', gap: 2 },
  weekNavLabel: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold' },
  weekNavBack: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', paddingVertical: 4 },

  overviewCard: { borderRadius: 28, padding: 24, overflow: 'hidden' },
  overviewBlob: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.06)', top: -50, right: -20,
  },
  overviewValue: { fontSize: 52, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#fff', lineHeight: 58 },
  overviewLabel: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', color: 'rgba(255,255,255,0.9)' },
  overviewSub: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: 'rgba(255,255,255,0.85)', marginTop: 12 },

  card: { padding: 20 },
  sectionLabel: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 18 },
  emptyText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center', paddingVertical: 12 },

  chart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  barContainer: { flex: 1, alignItems: 'center', gap: 8 },
  barTrack: { width: 24, height: CHART_H, borderRadius: 12, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 12 },
  barDay: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold' },

  distRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  distMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  distLabel: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
  distCount: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },
  distTrack: { height: 10, borderRadius: 5, overflow: 'hidden' },
  distFill: { height: '100%', borderRadius: 5 },

  recHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recTitle: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold' },
  recText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 22 },
});
