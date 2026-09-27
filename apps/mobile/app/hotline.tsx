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
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Neu } from '@prototype/ui-shared';
import { BottomNav, FadeIn, NeuView, ScreenHeader, useToast } from '../components/ui';
import { callNumber } from '../components/chat/AlertModal';
import { apiGetHotline } from '@prototype/api-client';

type HotlineItem = {
  nama: string;
  nomor: string;
  deskripsi?: string;
};

export default function HotlineScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const toast = useToast();
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
        toast.show('Daftar terbaru belum bisa dimuat. Nomor darurat utama tetap bisa dihubungi dari chat.', 'info');
      } finally {
        setLoading(false);
      }
    }
    fetchHotlines();
  }, []);

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
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 130 }]}
      >
        <FadeIn delay={0}>
          <ScreenHeader back title="Hotline darurat" subtitle="Bantuan profesional, gratis dan rahasia." />
        </FadeIn>

        {/* ── Comfort banner ── */}
        <FadeIn delay={80}>
          <View style={[s.bannerCard, { backgroundColor: colors.primary, boxShadow: Neu.raised }]}>
            <View style={s.bannerBlob} />
            <Ionicons name="heart-outline" size={32} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={s.bannerTitle}>Kamu tidak sendirian</Text>
              <Text style={s.bannerText}>
                Saat merasa cemas, tertekan, atau butuh didengar, layanan ini siap membantu.
              </Text>
            </View>
          </View>
        </FadeIn>

        {/* ── Search ── */}
        <FadeIn delay={140}>
          <NeuView inset radius={18} style={s.searchContainer}>
            <Ionicons name="search" size={20} color={colors.onSurfaceVariant} />
            <TextInput
              style={[s.searchInput, { color: colors.onSurface }]}
              placeholder="Cari layanan hotline"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Cari layanan hotline"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Hapus pencarian">
                <Ionicons name="close-circle" size={20} color={colors.onSurfaceVariant} />
              </Pressable>
            )}
          </NeuView>
        </FadeIn>

        {/* ── List ── */}
        <FadeIn delay={200}>
          {filteredHotlines.length === 0 ? (
            <NeuView inset radius={24} style={s.emptyBox}>
              <Ionicons name="search-outline" size={36} color={colors.onSurfaceVariant} />
              <Text style={[s.emptyText, { color: colors.onSurfaceVariant }]}>Tidak ada layanan yang cocok.</Text>
            </NeuView>
          ) : (
            <View style={s.listContainer}>
              {filteredHotlines.map((item, index) => (
                <Pressable
                  key={index}
                  onPress={() => callNumber(item.nomor)}
                  accessibilityRole="button"
                  accessibilityLabel={`Telepon ${item.nama}, ${item.nomor}`}
                  style={({ pressed }) => [
                    s.card,
                    { backgroundColor: colors.background, boxShadow: pressed ? Neu.inset : Neu.raised },
                  ]}
                >
                  <View style={s.infoColumn}>
                    <Text style={[s.cardTitle, { color: colors.onSurface }]}>{item.nama}</Text>
                    <Text style={[s.cardPhone, { color: colors.primary }]}>{item.nomor}</Text>
                    {item.deskripsi ? (
                      <Text style={[s.cardDesc, { color: colors.onSurfaceVariant }]}>{item.deskripsi}</Text>
                    ) : null}
                  </View>
                  <View style={[s.callBtn, { backgroundColor: colors.stressHigh }]}>
                    <Ionicons name="call" size={20} color="#fff" />
                  </View>
                </Pressable>
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
  scroll: { paddingHorizontal: 20, gap: 20 },

  bannerCard: {
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    overflow: 'hidden',
  },
  bannerBlob: {
    position: 'absolute', width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.06)', top: -30, right: -20,
  },
  bannerTitle: { fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#fff', marginBottom: 4 },
  bannerText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: 'rgba(255,255,255,0.9)', lineHeight: 20 },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    height: 52,
  },
  searchInput: { flex: 1, height: '100%', fontSize: 15, fontFamily: 'PlusJakartaSans_500Medium' },

  listContainer: { gap: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 18,
    borderRadius: 22,
  },
  infoColumn: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold' },
  cardPhone: { fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  cardDesc: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 19, marginTop: 4 },
  callBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },

  emptyBox: { padding: 32, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', textAlign: 'center' },
});
