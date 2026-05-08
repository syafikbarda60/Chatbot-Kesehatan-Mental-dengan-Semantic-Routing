import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

import { BottomNav, FadeIn } from '../components/ui';
import { useTheme } from '../constants/ThemeContext';
import { Spacing } from '../constants/theme';

const { width } = Dimensions.get('window');

// Stat cards are square — same size
const CARD_SIZE = (width - Spacing.base * 2 - 12) / 2;

const MENU = [
  { icon: 'notifications-outline', label: 'Notifikasi',  danger: false },
  { icon: 'lock-closed-outline',   label: 'Privasi',             danger: false },
  { icon: 'color-palette-outline', label: 'Tampilan',                  danger: false },
  { icon: 'log-out-outline',       label: 'Keluar',                    danger: true },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* ── Floating Nav overlay ── */}
      <View
        style={[
          s.navBar,
          {
            paddingTop: insets.top + 12,
            backgroundColor: colors.background + 'E8',
            borderBottomColor: colors.outlineVariant + '20',
          }
        ]}
      >
        <View style={s.navInner}>
          <View style={[s.navAvatar, { backgroundColor: colors.surfaceContainerHigh }]}>
            <Ionicons name="person" size={15} color={colors.onSurfaceVariant} />
          </View>
          <Text style={[s.navBrand, { color: colors.onSurface }]}>Sanctuary</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity>
            <Ionicons name="settings-outline" size={22} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 70 }]}
      >
        {/* ── Profile Header ── */}
        <FadeIn delay={0}>
          <View style={s.profileHeader}>
            <Text style={[s.profileName, { color: colors.onSurface }]}>Elena Vance</Text>
            <Text style={[s.studentId, { color: colors.outline }]}>Student ID: 882049-X</Text>
          </View>
        </FadeIn>

        {/* ── Stats Bento Grid (2 square cards) ── */}
        <FadeIn delay={80}>
          <View style={s.bentoRow}>
            {/* Card 1 */}
            <View style={[s.bentoCard, { backgroundColor: colors.surfaceContainerLowest, width: CARD_SIZE, height: CARD_SIZE }]}>
              <Ionicons name="calendar-outline" size={28} color={colors.primary} />
              <View style={s.bentoBottom}>
                <Text style={[s.bentoValue, { color: colors.onSurface }]}>124</Text>
                <Text style={[s.bentoLabel, { color: colors.onSurfaceVariant }]}>Days Active</Text>
              </View>
            </View>

            {/* Card 2 */}
            <View style={[s.bentoCard, { backgroundColor: colors.surfaceContainerLowest, width: CARD_SIZE, height: CARD_SIZE }]}>
              <Ionicons name="create-outline" size={28} color={colors.primary} />
              <View style={s.bentoBottom}>
                <Text style={[s.bentoValue, { color: colors.onSurface }]}>48</Text>
                <Text style={[s.bentoLabel, { color: colors.onSurfaceVariant }]}>Journals Completed</Text>
              </View>
            </View>
          </View>
        </FadeIn>

        {/* ── Weekly Focus Editorial Card ── */}
        <FadeIn delay={160}>
          <LinearGradient
            colors={['#496175', '#3d5569']}
            style={s.editCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Decorative blobs */}
            <View style={s.editBlob1} />
            <View style={s.editBlob2} />

            <View style={{ zIndex: 1 }}>
              <Text style={s.editTag}>EDITORIAL FOCUS</Text>
              <Text style={s.editTitle}>Weekly Focus: The Art of Stillness</Text>
              <Text style={s.editDesc}>
                Minggu ini, kita eksplorasi manfaat neurologis dari keheningan yang disengaja dalam lingkungan akademis yang penuh tekanan.
              </Text>
              <TouchableOpacity style={s.editBtn} activeOpacity={0.85}>
                <Text style={[s.editBtnText, { color: '#496175' }]}>Enter Sanctuary</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </FadeIn>

        {/* ── Account Preferences ── */}
        <FadeIn delay={240}>
          <Text style={[s.prefTitle, { color: colors.outline }]}>ACCOUNT PREFERENCES</Text>
          <View style={[s.prefCard, { backgroundColor: colors.surfaceContainerLow }]}>
            {MENU.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  s.prefItem,
                  { backgroundColor: colors.surfaceContainerLowest },
                  i < MENU.length - 1 && s.prefItemGap,
                ]}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={item.icon as any}
                  size={20}
                  color={item.danger ? colors.error : colors.onSurfaceVariant}
                />
                <Text style={[
                  s.prefLabel,
                  { color: item.danger ? colors.error : colors.onSurface }
                ]}>
                  {item.label}
                </Text>
                <View style={{ flex: 1 }} />
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={item.danger ? colors.error + '60' : colors.outlineVariant}
                />
              </TouchableOpacity>
            ))}
          </View>
        </FadeIn>

        {/* ── Weekly Summary mini stats ── */}
        <FadeIn delay={320}>
          <View style={[s.summaryCard, { backgroundColor: colors.surfaceContainerLowest }]}>
            {[
              { icon: 'chatbubble-outline', label: 'Sesi Chat', val: '8', color: colors.primary },
              { icon: 'checkmark-circle-outline', label: 'Asesmen', val: '2', color: '#4D9B6F' },
              { icon: 'flame-outline', label: 'Streak', val: '5🔥', color: '#D4A843' },
            ].map((stat, i) => (
              <View key={i} style={[s.statItem, i > 0 && { borderLeftWidth: 1, borderLeftColor: colors.outlineVariant + '30' }]}>
                <Ionicons name={stat.icon as any} size={20} color={stat.color} />
                <Text style={[s.statVal, { color: colors.onSurface }]}>{stat.val}</Text>
                <Text style={[s.statLabel, { color: colors.onSurfaceVariant }]}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </FadeIn>

        <Text style={[s.version, { color: colors.outline }]}>Sanctuary v1.0.0 Beta</Text>

        <View style={{ height: 110 }} />
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1 },

  navBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    zIndex: 50, borderBottomWidth: 1,
  },
  navInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingBottom: 12, gap: 8,
  },
  navAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  navBrand:  { fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.4 },

  scroll: { paddingHorizontal: Spacing.base },

  // Profile header
  profileHeader: { marginBottom: 32, paddingHorizontal: 4 },
  profileName: {
    fontSize: 42,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: -1.5,
    lineHeight: 48,
    marginBottom: 6,
  },
  studentId: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },

  // Bento grid (two square cards)
  bentoRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  bentoCard: {
    borderRadius: 24,
    padding: 24,
    justifyContent: 'space-between',
    shadowColor: '#2b3437',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06, shadowRadius: 20, elevation: 3,
  },
  bentoBottom: { gap: 4 },
  bentoValue: {
    fontSize: 32, fontFamily: 'PlusJakartaSans_800ExtraBold', lineHeight: 36,
  },
  bentoLabel: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium' },

  // Editorial card
  editCard: {
    borderRadius: 24,
    padding: 32,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: '#496175',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28, shadowRadius: 24, elevation: 8,
  },
  editBlob1: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.06)', top: -60, right: -40,
  },
  editBlob2: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.04)', bottom: -20, left: 40,
  },
  editTag: {
    fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 2, color: 'rgba(255,255,255,0.65)', marginBottom: 12,
  },
  editTitle: {
    fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#ffffff', letterSpacing: -0.4,
    lineHeight: 26, marginBottom: 12,
  },
  editDesc: {
    fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular',
    color: 'rgba(255,255,255,0.75)', lineHeight: 20, marginBottom: 20,
  },
  editBtn: {
    backgroundColor: '#ffffff', alignSelf: 'flex-start',
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999,
  },
  editBtnText: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold' },

  // Preferences
  prefTitle: {
    fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 2, textTransform: 'uppercase',
    marginBottom: 10, paddingHorizontal: 4,
  },
  prefCard: {
    borderRadius: 24, padding: 8, marginBottom: 16,
  },
  prefItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16, borderRadius: 20,
    gap: 14,
  },
  prefItemGap: { marginBottom: 4 },
  prefLabel: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium' },

  // Summary stats
  summaryCard: {
    flexDirection: 'row', borderRadius: 24, padding: 24,
    marginBottom: 16,
    shadowColor: '#2b3437',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 6 },
  statVal:   { fontSize: 22, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  statLabel: { fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', textAlign: 'center' },

  version: {
    textAlign: 'center', fontSize: 11,
    fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 24,
  },
});
