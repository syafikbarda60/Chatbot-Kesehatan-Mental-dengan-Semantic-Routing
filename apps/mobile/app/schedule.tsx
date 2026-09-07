import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@prototype/ui-shared';
import { BottomNav, FadeIn } from '../components/ui';
import { apiGetJadwal, apiGetKonselor, JadwalSlot as Jadwal, apiBuatBooking } from '@prototype/api-client';

// ── Helpers ───────────────────────────────────────────────────────────────────

type Counselor = {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  sessions: number;
  avatar: string;
  color: string;
};



const DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

function getDates() {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      day: DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1],
      date: d.getDate(),
      full: d,
      formatted: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    };
  });
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const dates = getDates();

  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [jadwalList, setJadwalList] = useState<Jadwal[]>([]);
  const [selectedCounselor, setSelectedCounselor] = useState<Counselor | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<Jadwal | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    async function loadData() {
      try {
        const [cRes, jRes] = await Promise.all([apiGetKonselor(), apiGetJadwal()]);
        const mapped = cRes.users.map((u: any, i: number) => ({
          id: u.user_id,
          name: u.nama,
          specialty: u.role === 'konselor' ? 'Konselor Psikologi' : 'Layanan Dukungan',
          rating: parseFloat((4.8 + (i % 2) * 0.1).toFixed(1)),
          sessions: 120 + i * 35,
          avatar: 'person',
          color: i % 2 === 0 ? '#5C8B9E' : '#7B8C6E',
        }));
        setCounselors(mapped);
        if (mapped.length > 0) setSelectedCounselor(mapped[0]);
        setJadwalList(jRes.jadwal);
      } catch (err) {
        console.warn('Gagal memuat jadwal', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const selectedDateStr = dates[selectedDay].formatted;
  const availableSlots = selectedCounselor
    ? jadwalList.filter(j => j.konselor_id === selectedCounselor.id && j.tanggal === selectedDateStr && j.status === 'tersedia')
    : [];

  const handleBook = async () => {
    if (!selectedSlot) {
      Alert.alert('Pilih Waktu', 'Silakan pilih slot waktu konsultasi terlebih dahulu.');
      return;
    }
    const date = dates[selectedDay];
    setIsBooking(true);
    
    try {
      await apiBuatBooking(selectedSlot.jadwal_id);
      Alert.alert(
        'Berhasil Dijadwalkan! 🎉',
        `Konsultasi dengan ${selectedCounselor?.name} pada ${date.day}, ${date.date} pukul ${selectedSlot.waktu_mulai} telah dikonfirmasi.`,
        [{ text: 'OK', onPress: () => setSelectedSlot(null) }]
      );
      // Refresh jadwal
      const jRes = await apiGetJadwal();
      setJadwalList(jRes.jadwal);
    } catch (e: any) {
      Alert.alert('Gagal Booking', e.message);
    } finally {
      setIsBooking(false);
    }
  };

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
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 24, paddingBottom: 120 }]}
      >
        {/* ── Header ── */}
        <FadeIn delay={0}>
          <View style={s.headerRow}>
            <View>
              <Text style={[s.eyebrow, { color: colors.outline }]}>KONSULTASI</Text>
              <Text style={[s.title, { color: colors.onSurface }]}>Jadwal Sesi</Text>
            </View>
            <View style={[s.headerIcon, { backgroundColor: colors.primaryContainer }]}>
              <Ionicons name="calendar" size={22} color={colors.primary} />
            </View>
          </View>
        </FadeIn>

        {/* ── Counselors ── */}
        <FadeIn delay={80}>
          <Text style={[s.sectionLabel, { color: colors.onSurfaceVariant }]}>Pilih Konselor</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', gap: 12, paddingRight: 8 }}>
              {counselors.map((c) => {
                const active = selectedCounselor?.id === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    activeOpacity={0.8}
                    onPress={() => setSelectedCounselor(c)}
                    style={[
                      s.counselorCard,
                      {
                        backgroundColor: active ? colors.surfaceContainerLow : colors.surfaceContainerLowest,
                        borderColor: active ? colors.primary : 'transparent',
                        borderWidth: active ? 2 : 1,
                      },
                    ]}
                  >
                    <View style={[s.avatarCircle, { backgroundColor: c.color + '25' }]}>
                      <Ionicons name="person" size={24} color={c.color} />
                    </View>
                    <Text style={[s.counselorName, { color: colors.onSurface }]} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={[s.counselorSpec, { color: colors.outline }]} numberOfLines={1}>
                      {c.specialty}
                    </Text>
                    <View style={s.counselorMeta}>
                      <Ionicons name="star" size={11} color="#F4C430" />
                      <Text style={[s.counselorRating, { color: colors.onSurfaceVariant }]}>
                        {c.rating} · {c.sessions} sesi
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </FadeIn>

        {/* ── Selected Counselor Banner ── */}
        {selectedCounselor && (
          <FadeIn delay={140}>
            <LinearGradient
              colors={[selectedCounselor.color, selectedCounselor.color + 'AA']}
              style={s.bannerCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={s.bannerBlob} />
              <View style={[s.bannerAvatar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Ionicons name="person" size={32} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.bannerName}>{selectedCounselor.name}</Text>
                <Text style={s.bannerSpec}>{selectedCounselor.specialty}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Ionicons name="star" size={12} color="#F4C430" />
                  <Text style={s.bannerRating}>{selectedCounselor.rating} rating</Text>
                </View>
              </View>
            </LinearGradient>
          </FadeIn>
        )}

        {/* ── Date Picker ── */}
        <FadeIn delay={200}>
          <Text style={[s.sectionLabel, { color: colors.onSurfaceVariant }]}>Pilih Tanggal</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', gap: 10, paddingRight: 8 }}>
              {dates.map((d, i) => {
                const active = selectedDay === i;
                return (
                  <TouchableOpacity
                    key={i}
                    activeOpacity={0.8}
                    onPress={() => { setSelectedDay(i); setSelectedSlot(null); }}
                    style={[
                      s.dateChip,
                      {
                        backgroundColor: active ? colors.primary : colors.surfaceContainerLowest,
                        shadowColor: active ? colors.primary : 'transparent',
                        shadowOpacity: active ? 0.4 : 0,
                        shadowRadius: 8,
                        elevation: active ? 4 : 0,
                      },
                    ]}
                  >
                    <Text style={[s.dayLabel, { color: active ? 'rgba(255,255,255,0.75)' : colors.outline }]}>
                      {d.day}
                    </Text>
                    <Text style={[s.dateNum, { color: active ? '#fff' : colors.onSurface }]}>
                      {d.date}
                    </Text>
                    {i === 0 && (
                      <View style={[s.todayDot, { backgroundColor: active ? 'rgba(255,255,255,0.6)' : colors.primary }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </FadeIn>

        {/* ── Time Slots ── */}
        <FadeIn delay={260}>
          <Text style={[s.sectionLabel, { color: colors.onSurfaceVariant }]}>Pilih Waktu</Text>
          {availableSlots.length === 0 ? (
            <View style={[s.emptySlotBox, { backgroundColor: colors.surfaceContainerLow }]}>
              <Ionicons name="calendar-clear-outline" size={32} color={colors.outline} />
              <Text style={[s.emptySlotText, { color: colors.outline }]}>Tidak ada jadwal tersedia di hari ini</Text>
            </View>
          ) : (
            <View style={s.slotsGrid}>
              {availableSlots.map((slot) => {
                const active = selectedSlot?.jadwal_id === slot.jadwal_id;
                return (
                  <TouchableOpacity
                    key={slot.jadwal_id}
                    activeOpacity={0.8}
                    onPress={() => setSelectedSlot(slot)}
                    style={[
                      s.slotChip,
                      {
                        backgroundColor: active ? colors.primary : colors.surfaceContainerLowest,
                        borderColor: active ? colors.primary : colors.outlineVariant,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color={active ? 'rgba(255,255,255,0.8)' : colors.outline}
                    />
                    <Text style={[s.slotText, { color: active ? '#fff' : colors.onSurface }]}>
                      {slot.waktu_mulai.substring(0, 5)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </FadeIn>

        {/* ── Session Info ── */}
        {selectedSlot && (
          <FadeIn delay={0}>
            <View style={[s.infoCard, { backgroundColor: colors.primaryContainer, borderColor: colors.primary + '30', borderWidth: 1 }]}>
              <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
              <Text style={[s.infoText, { color: colors.onPrimaryContainer }]}>
                Sesi · {dates[selectedDay].day}, {dates[selectedDay].date} pukul {selectedSlot.waktu_mulai.substring(0, 5)} - {selectedSlot.waktu_selesai.substring(0, 5)}
              </Text>
            </View>
          </FadeIn>
        )}

        {/* ── Book Button ── */}
        <FadeIn delay={300}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleBook}
            disabled={isBooking}
            style={[s.bookBtn, { backgroundColor: colors.primary, opacity: selectedSlot ? 1 : 0.5 }]}
          >
            {isBooking ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="calendar-outline" size={18} color="#fff" />
                <Text style={s.bookBtnText}>Konfirmasi Jadwal</Text>
              </>
            )}
          </TouchableOpacity>
        </FadeIn>
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 24 },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  eyebrow: { fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 4 },
  title: { fontSize: 28, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.8 },
  headerIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

  sectionLabel: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 12, letterSpacing: 0.3 },

  // Counselor cards
  counselorCard: {
    width: 150,
    padding: 16,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#2b3437',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  avatarCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  counselorName: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold' },
  counselorSpec: { fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium' },
  counselorMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  counselorRating: { fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium' },

  // Banner
  bannerCard: {
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 28,
    overflow: 'hidden',
    shadowColor: '#496175',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  bannerBlob: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.07)', top: -50, right: -30,
  },
  bannerAvatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  bannerName: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: '#fff', marginBottom: 2 },
  bannerSpec: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: 'rgba(255,255,255,0.8)' },
  bannerRating: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: 'rgba(255,255,255,0.9)' },

  // Date chips
  dateChip: {
    width: 52,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    gap: 4,
  },
  dayLabel: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold' },
  dateNum: { fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  todayDot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },

  // Slot grid
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  slotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    width: '22%',
    minWidth: 78,
  },
  slotText: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold' },
  emptySlotBox: {
    padding: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 20,
  },
  emptySlotText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, textAlign: 'center' },

  // Info card
  infoCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, padding: 14, marginBottom: 20 },
  infoText: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', flex: 1 },

  // Book button
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 20,
    shadowColor: '#496175',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  bookBtnText: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: '#fff' },
});
