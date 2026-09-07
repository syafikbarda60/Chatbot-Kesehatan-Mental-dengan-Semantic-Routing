import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@prototype/ui-shared';
import { BottomNav, FadeIn } from '../components/ui';
import { apiGetHotline } from '@prototype/api-client';

type HotlineItem = {
  nama: string;
  nomor: string;
  deskripsi?: string;
};

export default function HotlineScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [hotlines, setHotlines] = useState<HotlineItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHotlines() {
      try {
        const res = await apiGetHotline();
        setHotlines(res.hotlines || []);
      } catch (err) {
        console.warn('Gagal mengambil hotline', err);
        Alert.alert('Info', 'Gagal memuat daftar hotline terbaru. Menggunakan data cadangan.');
      } finally {
        setLoading(false);
      }
    }
    fetchHotlines();
  }, []);

  const handleCall = (nomor: string) => {
    // Bersihkan karakter non-digit kecuali + untuk panggil telepon
    const cleanNum = nomor.replace(/[^\d+]/g, '');
    Linking.openURL(`tel:${cleanNum}`).catch(() => {
      Alert.alert('Gagal Panggil', `Tidak dapat membuka dialer untuk nomor: ${nomor}`);
    });
  };

  const filteredHotlines = hotlines.filter(h =>
    h.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (h.deskripsi && h.deskripsi.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <View style={[s.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 24, paddingBottom: 130 }]}
      >
        {/* ── Header ── */}
        <FadeIn delay={0}>
          <View style={s.headerRow}>
            <View>
              <Text style={[s.eyebrow, { color: colors.outline }]}>DARURAT & BANTUAN</Text>
              <Text style={[s.title, { color: colors.onSurface }]}>Kontak Hotline</Text>
            </View>
            <View style={[s.headerIcon, { backgroundColor: colors.primaryContainer }]}>
              <Ionicons name="call" size={22} color={colors.primary} />
            </View>
          </View>
        </FadeIn>

        {/* ── Comforting Support Banner ── */}
        <FadeIn delay={80}>
          <LinearGradient
            colors={[colors.primary, colors.primary + 'CC']}
            style={s.bannerCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={s.bannerBlob} />
            <Ionicons name="heart-half-outline" size={40} color="#fff" style={s.bannerIcon} />
            <View style={{ flex: 1 }}>
              <Text style={s.bannerTitle}>Kamu Tidak Sendirian</Text>
              <Text style={s.bannerText}>
                Jika kamu merasa cemas, tertekan, atau membutuhkan seseorang untuk didengar, bantuan profesional gratis selalu siap mendukungmu.
              </Text>
            </View>
          </LinearGradient>
        </FadeIn>

        {/* ── Search Bar ── */}
        <FadeIn delay={140}>
          <View style={[s.searchContainer, { backgroundColor: colors.surfaceContainerLow }]}>
            <Ionicons name="search" size={20} color={colors.outline} style={s.searchIcon} />
            <TextInput
              style={[s.searchInput, { color: colors.onSurface }]}
              placeholder="Cari layanan hotline..."
              placeholderTextColor={colors.outlineVariant}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.outline} />
              </TouchableOpacity>
            )}
          </View>
        </FadeIn>

        {/* ── Hotlines List ── */}
        <FadeIn delay={200}>
          {filteredHotlines.length === 0 ? (
            <View style={[s.emptyBox, { backgroundColor: colors.surfaceContainerLowest }]}>
              <Ionicons name="alert-circle-outline" size={48} color={colors.outline} />
              <Text style={[s.emptyText, { color: colors.outline }]}>Tidak ada kontak hotline yang cocok.</Text>
            </View>
          ) : (
            <View style={s.listContainer}>
              {filteredHotlines.map((item, index) => (
                <View
                  key={index}
                  style={[s.card, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant + '15', borderWidth: 1 }]}
                >
                  <View style={s.cardHeader}>
                    <View style={s.infoColumn}>
                      <Text style={[s.cardTitle, { color: colors.onSurface }]}>{item.nama}</Text>
                      <Text style={[s.cardPhone, { color: colors.primary }]}>{item.nomor}</Text>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleCall(item.nomor)}
                      style={[s.callBtn, { backgroundColor: colors.primaryContainer }]}
                    >
                      <Ionicons name="call" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                  {item.deskripsi && (
                    <Text style={[s.cardDesc, { color: colors.onSurfaceVariant }]}>
                      {item.deskripsi}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </FadeIn>
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 24 },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  eyebrow: { fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 4 },
  title: { fontSize: 28, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.8 },
  headerIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

  // Comfort Banner
  bannerCard: {
    borderRadius: 24,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: '#496175',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
  bannerBlob: {
    position: 'absolute', width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.06)', top: -30, right: -20,
  },
  bannerIcon: { textShadowColor: 'rgba(0,0,0,0.15)', textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 4 },
  bannerTitle: { fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#fff', marginBottom: 4 },
  bannerText: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: 'rgba(255,255,255,0.9)', lineHeight: 18 },

  // Search Bar
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 24,
  },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, height: '100%', fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium' },

  // Hotline List & Cards
  listContainer: { gap: 16 },
  card: {
    padding: 20,
    borderRadius: 20,
    shadowColor: '#2b3437',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  infoColumn: { flex: 1, marginRight: 12 },
  cardTitle: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 2 },
  cardPhone: { fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  cardDesc: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', lineHeight: 18, marginTop: 4 },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty State
  emptyBox: {
    padding: 40,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyText: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', textAlign: 'center' },
});
