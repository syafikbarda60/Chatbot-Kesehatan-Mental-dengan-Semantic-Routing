import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@prototype/ui-shared';
import { FadeIn } from '../components/ui';

export default function JournalDetailScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  
  // Ambil data yang di-passing dari halaman history
  const params = useLocalSearchParams();
  const { content, mood, created_at } = params as any;

  const formatDate = (isoStr: string) => {
    if (!isoStr) return '';
    return new Date(isoStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      weekday: 'long',
    });
  };

  const getMoodConfig = (m: string) => {
    switch (m) {
      case 'Calm': return { icon: 'water-outline', bg: '#E3F2FD', color: '#1976D2' };
      case 'Anxious': return { icon: 'pulse-outline', bg: '#FFEBEE', color: '#D32F2F' };
      case 'Focused': return { icon: 'locate-outline', bg: '#E8F5E9', color: '#388E3C' };
      case 'Tired': return { icon: 'moon-outline', bg: '#F3E5F5', color: '#7B1FA2' };
      default: return { icon: 'leaf-outline', bg: colors.surfaceContainerLow, color: colors.primary };
    }
  };

  const moodConfig = getMoodConfig(mood);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={28} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.onSurface }]}>Momen Jurnal</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <FadeIn delay={100}>
          {/* Mood & Date Card */}
          <View style={[s.topCard, { backgroundColor: colors.surfaceContainerLowest }]}>
            <View style={[s.moodIconWrapper, { backgroundColor: moodConfig.bg }]}>
              <Ionicons name={moodConfig.icon as any} size={32} color={moodConfig.color} />
            </View>
            <View style={{ alignItems: 'center', marginTop: 16 }}>
              <Text style={[s.dateText, { color: colors.onSurface }]}>{formatDate(created_at)}</Text>
              {mood && (
                <Text style={[s.moodText, { color: moodConfig.color }]}>Merasa {mood}</Text>
              )}
            </View>
          </View>
        </FadeIn>

        <FadeIn delay={200}>
          {/* Journal Content Area */}
          <View style={s.contentWrapper}>
            <Ionicons name="quote" size={48} color={colors.primary + '15'} style={s.quoteIcon} />
            <Text style={[s.contentText, { color: colors.onSurface }]}>
              {content}
            </Text>
          </View>
        </FadeIn>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#00000008',
  },
  backBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold' },
  scroll: { padding: 24 },
  
  topCard: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 24,
    shadowColor: '#2b3437',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
    marginBottom: 24,
  },
  moodIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: { 
    fontSize: 16, 
    fontFamily: 'PlusJakartaSans_800ExtraBold', 
    marginBottom: 4 
  },
  moodText: { 
    fontSize: 14, 
    fontFamily: 'PlusJakartaSans_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  contentWrapper: {
    position: 'relative',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  quoteIcon: {
    position: 'absolute',
    top: -10,
    left: -8,
  },
  contentText: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_500Medium',
    lineHeight: 32,
    marginTop: 16,
  },
});
