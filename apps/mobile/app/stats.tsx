import React, { useRef, useEffect } from 'react';
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

import { BottomNav, FadeIn } from '../components/ui';
import { useTheme } from '../constants/ThemeContext';
import { Typography, Spacing, BorderRadius } from '../constants/theme';

const { width } = Dimensions.get('window');

// Mock weekly data for the mood chart
const WEEK_DATA = [
  { day: 'Sen', score: 72 },
  { day: 'Sel', score: 65 },
  { day: 'Rab', score: 80 },
  { day: 'Kam', score: 55 },
  { day: 'Jum', score: 88 },
  { day: 'Sab', score: 92 },
  { day: 'Min', score: 70 },
];

const MAX_SCORE = 100;
const CHART_H   = 100;

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const barAnims = useRef(WEEK_DATA.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = barAnims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: WEEK_DATA[i].score / MAX_SCORE,
        duration: 600,
        delay: 100 + i * 60,
        useNativeDriver: false,
      })
    );
    Animated.parallel(animations).start();
  }, []);

  const overallScore = Math.round(WEEK_DATA.reduce((a, b) => a + b.score, 0) / WEEK_DATA.length);
  const getScoreColor = (s: number) => s >= 75 ? colors.stressLow : s >= 50 ? colors.stressMid : colors.stressHigh;

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
              <Text style={[styles.title, { color: colors.onSurface }]}>Laporan Mingguan</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Gambaran kondisi mentalmu 7 hari terakhir
              </Text>
            </View>
            <TouchableOpacity style={[styles.historyBtn, { borderColor: colors.outlineVariant + '60' }]}>
              <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.historyBtnText, { color: colors.textSecondary }]}>Riwayat</Text>
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
              <Text style={styles.overviewLabel}>Skor Kesejahteraan</Text>
              <Text style={styles.overviewScore}>{overallScore}</Text>
              <Text style={styles.overviewSub}>dari 100 poin</Text>
            </View>
            <View style={styles.overviewRight}>
              <View style={styles.overviewBadge}>
                <Ionicons name="trending-up-outline" size={20} color={colors.primary} />
                <Text style={[styles.overviewBadgeText, { color: colors.primary }]}>+8%</Text>
              </View>
              <Text style={styles.overviewRightSub}>vs minggu lalu</Text>
            </View>
          </LinearGradient>
        </FadeIn>

        {/* Bar Chart */}
        <FadeIn delay={150}>
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.sectionLabel, { color: colors.outline }]}>MOOD HARIAN</Text>
            <View style={styles.chart}>
              {WEEK_DATA.map((d, i) => (
                <View key={i} style={styles.barContainer}>
                  <View style={[styles.barTrack, { backgroundColor: colors.surfaceContainerHigh }]}>
                    <Animated.View
                      style={[
                        styles.barFill,
                        {
                          backgroundColor: getScoreColor(d.score),
                          height: barAnims[i].interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                          }),
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barDay, { color: colors.textMuted }]}>{d.day}</Text>
                  <Text style={[styles.barScore, { color: colors.textSecondary }]}>{d.score}</Text>
                </View>
              ))}
            </View>
          </View>
        </FadeIn>

        {/* Breakdown */}
        <FadeIn delay={220}>
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.sectionLabel, { color: colors.outline }]}>RINCIAN ASPEK</Text>
            {[
              { label: 'Ketenangan',      icon: 'water-outline',      score: 82, color: colors.primary  },
              { label: 'Fokus & Produktivitas', icon: 'locate-outline', score: 64, color: colors.tertiary },
              { label: 'Istirahat & Tidur', icon: 'moon-outline',     score: 71, color: '#7A5C3A'       },
              { label: 'Hubungan Sosial',  icon: 'people-outline',    score: 90, color: colors.stressLow},
            ].map((item, i) => (
              <View key={i} style={[styles.aspectRow, i > 0 && { borderTopColor: colors.outlineVariant + '30', borderTopWidth: 1 }]}>
                <View style={[styles.aspectIcon, { backgroundColor: item.color + '18' }]}>
                  <Ionicons name={item.icon as any} size={18} color={item.color} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.aspectMeta}>
                    <Text style={[styles.aspectLabel, { color: colors.onSurface }]}>{item.label}</Text>
                    <Text style={[styles.aspectScore, { color: item.color }]}>{item.score}%</Text>
                  </View>
                  <View style={[styles.aspectTrack, { backgroundColor: colors.surfaceContainerHigh }]}>
                    <View style={[styles.aspectFill, { backgroundColor: item.color, width: `${item.score}%` }]} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </FadeIn>

        {/* Recommendation */}
        <FadeIn delay={290}>
          <View style={[styles.recCard, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '40' }]}>
            <View style={styles.recHeader}>
              <View style={[styles.recIconWrap, { backgroundColor: colors.primaryContainer }]}>
                <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
              </View>
              <Text style={[styles.recTitle, { color: colors.primary }]}>Rekomendasi Sanctuary</Text>
            </View>
            <Text style={[styles.recText, { color: colors.textSecondary }]}>
              Skormu menunjukkan penurunan fokus di pertengahan minggu. Coba rutinitas meditasi 5 menit sebelum belajar untuk meningkatkan konsentrasi.
            </Text>
            <TouchableOpacity
              style={[styles.recBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/chat')}
              activeOpacity={0.85}
            >
              <Text style={[styles.recBtnText, { color: colors.onPrimary }]}>Mulai Sesi Sekarang</Text>
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
    marginBottom: Spacing.xl,
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
  overviewRightSub: { fontSize: 10, fontFamily: 'PlusJakartaSans_400Regular', color: 'rgba(255,255,255,0.65)' },

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
