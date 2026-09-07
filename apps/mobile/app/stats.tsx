import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { apiGetJournals } from '@prototype/api-client';

import { BottomNav, FadeIn } from '../components/ui';
import { useTheme } from '@prototype/ui-shared';
import { Typography, Spacing, BorderRadius } from '@prototype/ui-shared';

const { width } = Dimensions.get('window');

const INIT_WEEK = Array(7).fill({ day: '-', score: 0 });
const MAX_SCORE = 100;
const CHART_H   = 100;

// weekOffset: 0 = minggu ini, -1 = minggu lalu, dst.
function getWeekRange(weekOffset: number) {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 6 + weekOffset * 7);
  const end = new Date(today);
  end.setDate(today.getDate() + weekOffset * 7);
  return { start, end };
}

function formatWeekLabel(weekOffset: number) {
  if (weekOffset === 0) return 'Minggu Ini';
  if (weekOffset === -1) return 'Minggu Lalu';
  const { start, end } = getWeekRange(weekOffset);
  const fmt = (d: Date) =>
    d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [weekOffset, setWeekOffset] = React.useState(0);
  const [allJournals, setAllJournals] = React.useState<any[]>([]);
  const [weekData, setWeekData] = React.useState<{day: string, score: number}[]>(INIT_WEEK);
  const [moodCounts, setMoodCounts] = React.useState({
    calm: 0, focused: 0, tired: 0, anxious: 0, total: 0
  });
  const barAnims = useRef(INIT_WEEK.map(() => new Animated.Value(0))).current;

  // Fetch once
  useEffect(() => {
    async function loadData() {
      try {
        const res = await apiGetJournals(200, 0);
        setAllJournals(res.journals || []);
      } catch (e) {
        console.error(e);
      }
    }
    loadData();
  }, []);

  // Recompute whenever journals or weekOffset changes
  const computeStats = useCallback(() => {
    const journals = allJournals;
    if (journals.length === 0 && allJournals.length === 0) return;

    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const today = new Date();
    const newWeekData: {day: string, score: number}[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i + weekOffset * 7);
      const dateStr = d.toISOString().split('T')[0];

      const dayJournals = journals.filter((j: any) => j.created_at.startsWith(dateStr));

      let totalScore = 0;
      if (dayJournals.length > 0) {
        dayJournals.forEach((j: any) => {
          if (j.mood === 'Calm') totalScore += 100;
          else if (j.mood === 'Focused') totalScore += 80;
          else if (j.mood === 'Tired') totalScore += 50;
          else if (j.mood === 'Anxious') totalScore += 30;
          else totalScore += 70;
        });
        totalScore = Math.round(totalScore / dayJournals.length);
      } else {
        totalScore = 0;
      }

      newWeekData.push({ day: days[d.getDay()], score: totalScore });
    }

    setWeekData(newWeekData);

    // Mood distribution for selected week
    const { start, end } = getWeekRange(weekOffset);
    const endMidnight = new Date(end);
    endMidnight.setHours(23, 59, 59, 999);

    const periodJournals = journals.filter((j: any) => {
      const d = new Date(j.created_at);
      return d >= start && d <= endMidnight;
    });

    let calm = 0, focus = 0, tired = 0, anxious = 0;
    periodJournals.forEach((j: any) => {
      if (j.mood === 'Calm') calm++;
      else if (j.mood === 'Focused') focus++;
      else if (j.mood === 'Tired') tired++;
      else if (j.mood === 'Anxious') anxious++;
    });

    setMoodCounts({
      calm, focused: focus, tired, anxious,
      total: periodJournals.length
    });

    // Reset & animate bars
    barAnims.forEach(a => a.setValue(0));
    const animations = barAnims.map((anim, idx) =>
      Animated.timing(anim, {
        toValue: newWeekData[idx].score / MAX_SCORE,
        duration: 500,
        delay: 60 * idx,
        useNativeDriver: false,
      })
    );
    Animated.parallel(animations).start();
  }, [allJournals, weekOffset]);

  useEffect(() => {
    computeStats();
  }, [computeStats]);

  const overallScore = React.useMemo(() => {
    const nonZero = weekData.filter(d => d.score > 0);
    if (nonZero.length === 0) return 0;
    return Math.round(nonZero.reduce((a, b) => a + b.score, 0) / nonZero.length);
  }, [weekData]);

  const getScoreColor = (s: number) =>
    s >= 75 ? colors.stressLow : s >= 50 ? colors.stressMid : colors.stressHigh;

  // Dynamic Recommendation based on mood counts of the week
  const recommendation = React.useMemo(() => {
    if (moodCounts.total === 0) {
      return {
        title: 'Mulai Menulis Jurnal',
        text: 'Kamu belum menulis jurnal minggu ini. Tulis jurnal pertamamu hari ini untuk memantau emosi dan mendapatkan rekomendasi personal.',
        btnText: 'Tulis Jurnal Sekarang',
        action: () => router.push('/home'),
        icon: 'book-outline',
      };
    }

    const { calm, focused, tired, anxious } = moodCounts;
    const maxVal = Math.max(calm, focused, tired, anxious);

    if (maxVal === 0) {
      return {
        title: 'Mulai Menulis Jurnal',
        text: 'Kamu belum menulis jurnal minggu ini. Tulis jurnal pertamamu hari ini untuk memantau emosi dan mendapatkan rekomendasi personal.',
        btnText: 'Tulis Jurnal Sekarang',
        action: () => router.push('/home'),
        icon: 'book-outline',
      };
    }

    if (anxious === maxVal) {
      return {
        title: 'Tenangkan Pikiranmu',
        text: 'Tingkat kecemasanmu agak tinggi minggu ini. Mari tarik napas dalam-dalam, perlambat ritme harimu, dan bagikan apa yang kamu rasakan kepada AI companion kami.',
        btnText: 'Mulai Sesi Konseling',
        action: () => router.push('/chat'),
        icon: 'chatbubble-ellipses-outline',
      };
    }
    if (tired === maxVal) {
      return {
        title: 'Pulihkan Energimu',
        text: 'Kamu merasa lelah minggu ini. Coba luangkan waktu untuk tidur lebih awal atau lakukan aktivitas ringan yang menyegarkan pikiran seperti jalan santai.',
        btnText: 'Bicara dengan Sanctuary',
        action: () => router.push('/chat'),
        icon: 'moon-outline',
      };
    }
    if (focused === maxVal) {
      return {
        title: 'Fokus & Produktif',
        text: 'Minggu ini kamu sangat fokus dan produktif! Untuk menjaga stamina mental, pastikan kamu mengambil jeda singkat 5 menit di sela aktivitas.',
        btnText: 'Refleksi dengan AI',
        action: () => router.push('/chat'),
        icon: 'locate-outline',
      };
    }
    // calm is maxVal
    return {
      title: 'Pertahankan Ketenanganmu',
      text: 'Kondisimu sangat stabil dan tenang minggu ini. Pertahankan ketenangan ini dengan meluangkan waktu bersantai dan bersyukur setiap hari.',
      btnText: 'Lakukan Sesi Lanjutan',
      action: () => router.push('/chat'),
      icon: 'water-outline',
    };
  }, [moodCounts]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.xl }]}
      >
        {/* Header */}
        <FadeIn delay={0}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.onSurface }]}>Laporan</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Gambaran kondisi mentalmu
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.historyBtn, { borderColor: colors.outlineVariant + '60' }]}
              onPress={() => router.push('/journal-history')}
            >
              <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.historyBtnText, { color: colors.textSecondary }]}>Riwayat</Text>
            </TouchableOpacity>
          </View>
        </FadeIn>

        {/* Week Navigator */}
        <FadeIn delay={40}>
          <View style={[styles.weekNav, { backgroundColor: colors.surfaceContainerLowest }]}>
            <TouchableOpacity
              style={[styles.weekNavBtn, { opacity: 1 }]}
              onPress={() => setWeekOffset(prev => prev - 1)}
            >
              <Ionicons name="chevron-back" size={18} color={colors.primary} />
            </TouchableOpacity>

            <View style={styles.weekNavCenter}>
              <Text style={[styles.weekNavLabel, { color: colors.onSurface }]}>
                {formatWeekLabel(weekOffset)}
              </Text>
              {weekOffset < 0 && (
                <TouchableOpacity onPress={() => setWeekOffset(0)}>
                  <Text style={[styles.weekNavBack, { color: colors.primary }]}>Kembali ke minggu ini</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[styles.weekNavBtn, { opacity: weekOffset >= 0 ? 0.3 : 1 }]}
              onPress={() => weekOffset < 0 && setWeekOffset(prev => prev + 1)}
              disabled={weekOffset >= 0}
            >
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </FadeIn>

        {/* Overview Card */}
        <FadeIn delay={80}>
          <LinearGradient
            colors={[colors.primary, colors.primaryDim]}
            style={styles.overviewCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.overviewBlob} />
            <View>
              <Text style={styles.overviewLabel}>SKOR KESEJAHTERAAN</Text>
              <Text style={styles.overviewScore}>{overallScore}</Text>
              <Text style={styles.overviewSub}>dari 100 poin</Text>
            </View>
            <View style={styles.overviewRight}>
              <View style={styles.overviewBadge}>
                <Ionicons name="journal-outline" size={16} color={colors.primary} />
                <Text style={[styles.overviewBadgeText, { color: colors.primary }]}>
                  {moodCounts.total} jurnal
                </Text>
              </View>
              <Text style={styles.overviewRightSub}>{formatWeekLabel(weekOffset)}</Text>
            </View>
          </LinearGradient>
        </FadeIn>

        {/* Bar Chart */}
        <FadeIn delay={150}>
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.sectionLabel, { color: colors.outline }]}>MOOD HARIAN</Text>
            <View style={styles.chart}>
              {weekData.map((d, i) => (
                <View key={i} style={styles.barContainer}>
                  <View style={[styles.barTrack, { backgroundColor: colors.surfaceContainerHigh }]}>
                    <Animated.View
                      style={[
                        styles.barFill,
                        {
                          backgroundColor: d.score > 0 ? getScoreColor(d.score) : colors.outlineVariant + '40',
                          height: barAnims[i].interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                          }),
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barDay, { color: colors.textMuted }]}>{d.day}</Text>
                  <Text style={[styles.barScore, { color: colors.textSecondary }]}>
                    {d.score > 0 ? d.score : '-'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </FadeIn>

        {/* Mood Distribution */}
        <FadeIn delay={220}>
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.sectionLabel, { color: colors.outline }]}>DISTRIBUSI MOOD</Text>
            {moodCounts.total === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Tidak ada jurnal di periode ini
              </Text>
            ) : (
              [
                { label: 'Calm',    icon: 'water-outline',   count: moodCounts.calm,    color: colors.primary },
                { label: 'Focused', icon: 'locate-outline',  count: moodCounts.focused, color: colors.tertiary },
                { label: 'Tired',   icon: 'moon-outline',    count: moodCounts.tired,   color: '#7A5C3A' },
                { label: 'Anxious', icon: 'warning-outline', count: moodCounts.anxious, color: colors.stressHigh },
              ].map((item, i) => {
                const pct = moodCounts.total > 0 ? (item.count / moodCounts.total) * 100 : 0;
                return (
                  <View key={i} style={[styles.aspectRow, i > 0 && { borderTopColor: colors.outlineVariant + '30', borderTopWidth: 1 }]}>
                    <View style={[styles.aspectIcon, { backgroundColor: item.color + '18' }]}>
                      <Ionicons name={item.icon as any} size={18} color={item.color} />
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={styles.aspectMeta}>
                        <Text style={[styles.aspectLabel, { color: colors.onSurface }]}>{item.label}</Text>
                        <Text style={[styles.aspectScore, { color: item.color }]}>{item.count} kali</Text>
                      </View>
                      <View style={[styles.aspectTrack, { backgroundColor: colors.surfaceContainerHigh }]}>
                        <View style={[styles.aspectFill, { backgroundColor: item.color, width: `${pct}%` }]} />
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </FadeIn>

        {/* Recommendation */}
        <FadeIn delay={290}>
          <View style={[styles.recCard, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '40' }]}>
            <View style={styles.recHeader}>
              <View style={[styles.recIconWrap, { backgroundColor: colors.primaryContainer }]}>
                <Ionicons name={recommendation.icon as any} size={16} color={colors.primary} />
              </View>
              <Text style={[styles.recTitle, { color: colors.primary }]}>{recommendation.title}</Text>
            </View>
            <Text style={[styles.recText, { color: colors.textSecondary }]}>
              {recommendation.text}
            </Text>
            <TouchableOpacity
              style={[styles.recBtn, { backgroundColor: colors.primary }]}
              onPress={recommendation.action}
              activeOpacity={0.85}
            >
              <Text style={[styles.recBtnText, { color: colors.onPrimary }]}>{recommendation.btnText}</Text>
            </TouchableOpacity>
          </View>
        </FadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.base },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.base,
    paddingHorizontal: Spacing.xs,
  },
  title: { fontSize: Typography.xl, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.4 },
  subtitle: { fontSize: Typography.sm, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 4 },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  historyBtnText: { fontSize: Typography.xs, fontFamily: 'PlusJakartaSans_600SemiBold' },

  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.base,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  weekNavBtn: {
    padding: Spacing.sm,
  },
  weekNavCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  weekNavLabel: {
    fontSize: Typography.sm,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  weekNavBack: {
    fontSize: Typography.xs,
    fontFamily: 'PlusJakartaSans_400Regular',
  },

  overviewCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.base,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#496175',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 6,
  },
  overviewBlob: {
    position: 'absolute',
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -40, right: 20,
  },
  overviewLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  overviewScore: {
    fontSize: 56,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#ffffff',
    lineHeight: 60,
  },
  overviewSub: {
    fontSize: Typography.xs,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: 'rgba(255,255,255,0.65)',
  },
  overviewRight: { alignItems: 'center', gap: 4 },
  overviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  overviewBadgeText: { fontSize: Typography.sm, fontFamily: 'PlusJakartaSans_700Bold' },
  overviewRightSub: { fontSize: 10, fontFamily: 'PlusJakartaSans_400Regular', color: 'rgba(255,255,255,0.65)', textAlign: 'center' },

  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.base,
    shadowColor: '#2b3437',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.05,
    shadowRadius: 30,
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 2,
    marginBottom: Spacing.xl,
  },
  emptyText: {
    fontSize: Typography.sm,
    fontFamily: 'PlusJakartaSans_400Regular',
    textAlign: 'center',
    paddingVertical: Spacing.base,
  },

  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: CHART_H + 40,
  },
  barContainer: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: {
    width: 28,
    height: CHART_H,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: { width: '100%', borderRadius: BorderRadius.md },
  barDay: { fontSize: 10, fontFamily: 'PlusJakartaSans_600SemiBold' },
  barScore: { fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold' },

  aspectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.base,
  },
  aspectIcon: {
    width: 36, height: 36, borderRadius: BorderRadius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  aspectMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  aspectLabel: { fontSize: Typography.sm, fontFamily: 'PlusJakartaSans_700Bold' },
  aspectScore: { fontSize: Typography.sm, fontFamily: 'PlusJakartaSans_700Bold' },
  aspectTrack: { height: 5, borderRadius: BorderRadius.full, overflow: 'hidden' },
  aspectFill: { height: '100%', borderRadius: BorderRadius.full },

  recCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  recHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  recIconWrap: {
    width: 30, height: 30, borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  recTitle: { fontSize: Typography.sm, fontFamily: 'PlusJakartaSans_700Bold' },
  recText: {
    fontSize: Typography.sm,
    fontFamily: 'PlusJakartaSans_400Regular',
    lineHeight: Typography.sm * 1.7,
  },
  recBtn: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
  },
  recBtnText: { fontSize: Typography.sm, fontFamily: 'PlusJakartaSans_700Bold' },
});
