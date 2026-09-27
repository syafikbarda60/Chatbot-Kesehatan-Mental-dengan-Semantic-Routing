import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Neu } from '@prototype/ui-shared';
import { BottomNav, FadeIn, NeuView, Button, ScreenHeader, useToast } from '../components/ui';
import { Companion } from '../components/chat';
import type { Expression } from '@prototype/utils';
import {
  apiGetJadwal, apiGetKonselor, apiBuatBooking, apiGetBookingSaya, JadwalSlot as Jadwal,
} from '@prototype/api-client';
import { PressableScale } from '../components/ui';

type Counselor = { id: string; name: string; specialty: string };
type Booking = {
  booking_id: string;
  status: 'menunggu' | 'dikonfirmasi' | 'selesai' | 'dibatalkan';
  jadwal_konsultasi?: { tanggal: string; waktu_mulai: string; waktu_selesai: string; konselor_id: string };
};

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hm = (t?: string) => (t ?? '').substring(0, 5);

function getDates() {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      day: i === 0 ? 'Ini' : DAYS[d.getDay()],
      date: d.getDate(),
      long: d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }),
      formatted: ymd(d),
    };
  });
}

const initials = (name: string) => name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const toast = useToast();
  const dates = getDates();

  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [jadwalList, setJadwalList] = useState<Jadwal[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedCounselor, setSelectedCounselor] = useState<Counselor | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<Jadwal | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [cRes, jRes] = await Promise.all([apiGetKonselor(), apiGetJadwal()]);
      const mapped = cRes.users.map((u: any) => ({
        id: u.user_id,
        name: u.nama,
        specialty: u.role === 'konselor' ? 'Konselor psikologi' : 'Layanan dukungan',
      }));
      setCounselors(mapped);
      setSelectedCounselor((cur) => cur ?? mapped[0] ?? null);
      setJadwalList(jRes.jadwal);
      // Own bookings are a bonus: don't fail the whole screen if they can't load
      apiGetBookingSaya().then((b) => setBookings(b.bookings as Booking[])).catch(() => {});
    } catch (err) {
      console.warn('Gagal memuat jadwal', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedDate = dates[selectedDay];
  // Open slots for the chosen counselor/day, in time order; today's slots that already started are hidden
  const nowHM = new Date().toTimeString().substring(0, 5);
  const availableSlots = selectedCounselor
    ? jadwalList
        .filter((j) => j.konselor_id === selectedCounselor.id && j.tanggal === selectedDate.formatted && j.status === 'tersedia')
        .filter((j) => selectedDay !== 0 || hm(j.waktu_mulai) > nowHM)
        .sort((a, b) => a.waktu_mulai.localeCompare(b.waktu_mulai))
    : [];
  // First later day this week where the chosen counselor still has an open slot
  const nextOpenDay = dates.findIndex((d, i) => i > selectedDay && jadwalList.some(
    (j) => j.konselor_id === selectedCounselor?.id && j.tanggal === d.formatted && j.status === 'tersedia'));

  // Nearest upcoming session that is still active
  const today = ymd(new Date());
  const upcoming = bookings
    .filter((b) => (b.status === 'menunggu' || b.status === 'dikonfirmasi') && (b.jadwal_konsultasi?.tanggal ?? '') >= today)
    .sort((a, b) =>
      `${a.jadwal_konsultasi!.tanggal}${a.jadwal_konsultasi!.waktu_mulai}`.localeCompare(`${b.jadwal_konsultasi!.tanggal}${b.jadwal_konsultasi!.waktu_mulai}`),
    )[0];
  const counselorName = (id?: string) => counselors.find((c) => c.id === id)?.name ?? 'Konselor kampus';

  const handleBook = async () => {
    if (!selectedSlot) return;
    setIsBooking(true);
    try {
      await apiBuatBooking(selectedSlot.jadwal_id);
      // Bookings start as 'menunggu' until the counselor approves
      toast.show(`Permintaan sesi ${hm(selectedSlot.waktu_mulai)} terkirim. Tunggu konfirmasi konselor, ya.`);
      setSelectedSlot(null);
      await loadData();
    } catch (e: any) {
      toast.show(`Permintaan belum terkirim: ${e.message}`, 'error');
    } finally {
      setIsBooking(false);
    }
  };

  // Shared layout for friendly full-width states (empty / error)
  const StateCard = ({ face, title, body, children }: { face: Expression; title: string; body: string; children?: React.ReactNode }) => (
    <NeuView radius={24} style={s.stateCard}>
      <View style={s.stateRow}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={[s.stateTitle, { color: colors.onSurface }]}>{title}</Text>
          <Text style={[s.stateBody, { color: colors.onSurfaceVariant }]}>{body}</Text>
        </View>
        <Companion expression={face} size={116} />
      </View>
      {children}
    </NeuView>
  );

  const STATUS = {
    menunggu: { label: 'Menunggu konfirmasi', color: colors.stressMid, icon: 'time-outline' },
    dikonfirmasi: { label: 'Dikonfirmasi', color: '#3B7A56', icon: 'checkmark-circle-outline' },
  } as const;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 }]}
      >
        <ScreenHeader title="Konseling" subtitle="Ngobrol langsung dengan konselor kampus. Gratis dan rahasia." />

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : loadError ? (
          <StateCard face="bingung" title="Jadwal belum bisa dimuat" body="Periksa koneksi internetmu, lalu coba lagi.">
            <Button label="Coba lagi" onPress={loadData} icon={<Ionicons name="refresh" size={18} color="#fff" />} />
          </StateCard>
        ) : (
          <>
            {/* ── Your session / how it works ── */}
            <FadeIn>
              {upcoming ? (
                <NeuView radius={24} style={s.sessionCard}>
                  <Text style={[s.sectionLabel, { color: colors.onSurface, marginBottom: 0 }]}>Sesi kamu</Text>
                  <View style={s.sessionRow}>
                    <View style={[s.dateBlock, { backgroundColor: colors.amberFill }]}>
                      <Text style={s.dateBlockDay}>{new Date(upcoming.jadwal_konsultasi!.tanggal).getDate()}</Text>
                      <Text style={s.dateBlockMonth}>
                        {new Date(upcoming.jadwal_konsultasi!.tanggal).toLocaleDateString('id-ID', { month: 'short' })}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={[s.sessionName, { color: colors.onSurface }]} numberOfLines={1}>
                        {counselorName(upcoming.jadwal_konsultasi?.konselor_id)}
                      </Text>
                      <Text style={[s.sessionMeta, { color: colors.onSurfaceVariant }]}>
                        {new Date(upcoming.jadwal_konsultasi!.tanggal).toLocaleDateString('id-ID', { weekday: 'long' })}, {hm(upcoming.jadwal_konsultasi?.waktu_mulai)}–{hm(upcoming.jadwal_konsultasi?.waktu_selesai)}
                      </Text>
                      <View style={s.statusRow}>
                        <Ionicons name={STATUS[upcoming.status as 'menunggu' | 'dikonfirmasi'].icon} size={14} color={STATUS[upcoming.status as 'menunggu' | 'dikonfirmasi'].color} />
                        <Text style={[s.statusText, { color: STATUS[upcoming.status as 'menunggu' | 'dikonfirmasi'].color }]}>
                          {STATUS[upcoming.status as 'menunggu' | 'dikonfirmasi'].label}
                        </Text>
                      </View>
                    </View>
                  </View>
                </NeuView>
              ) : (
                <NeuView radius={24} style={s.intro}>
                  <View style={s.stateRow}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={[s.stateTitle, { color: colors.onSurface }]}>Belum ada sesi</Text>
                      <Text style={[s.stateBody, { color: colors.onSurfaceVariant }]}>
                        Kadang cerita langsung ke orang lebih melegakan. Begini caranya:
                      </Text>
                    </View>
                    <Companion expression="menyapa" size={116} />
                  </View>
                  <View style={s.steps}>
                    {['Pilih konselor', 'Pilih waktu', 'Tunggu konfirmasi'].map((t, i) => (
                      <View key={t} style={s.step}>
                        <View style={[s.stepNum, { backgroundColor: colors.background, boxShadow: Neu.inset }]}>
                          <Text style={[s.stepNumText, { color: colors.amber }]}>{i + 1}</Text>
                        </View>
                        <Text style={[s.stepText, { color: colors.onSurface }]}>{t}</Text>
                      </View>
                    ))}
                  </View>
                </NeuView>
              )}
            </FadeIn>

            {counselors.length === 0 ? (
              <FadeIn>
                <StateCard
                  face="tenang"
                  title="Konselor belum membuka jadwal"
                  body="Sambil menunggu, kamu tetap bisa cerita ke Sajiwa. Kalau darurat, hubungi hotline."
                >
                  <View style={s.stateActions}>
                    <Button label="Cerita ke Sajiwa" onPress={() => router.push('/chat')} style={{ flex: 1 }} />
                    <Button
                      label="Hotline"
                      variant="secondary"
                      onPress={() => router.push('/hotline')}
                      style={{ flex: 1 }}
                      textStyle={{ color: colors.stressHigh }}
                      icon={<Ionicons name="call-outline" size={16} color={colors.stressHigh} />}
                    />
                  </View>
                </StateCard>
              </FadeIn>
            ) : (
              <>
                {/* ── Counselors ── */}
                <FadeIn>
                  <Text style={[s.sectionLabel, { color: colors.onSurface }]}>Pilih konselor</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hList} style={s.hScroll}>
                    {counselors.map((c) => {
                      const active = selectedCounselor?.id === c.id;
                      return (
                        <PressableScale
                          key={c.id}
                          onPress={() => { setSelectedCounselor(c); setSelectedSlot(null); }}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={`${c.name}, ${c.specialty}`}
                          style={[s.counselorCard, { backgroundColor: colors.background, boxShadow: active ? Neu.inset : Neu.raisedSm }]}
                        >
                          <View style={[s.avatar, active ? { backgroundColor: colors.amber } : { backgroundColor: colors.background, boxShadow: Neu.inset }]}>
                            <Text style={[s.avatarText, { color: active ? colors.onPrimary : colors.amber }]}>{initials(c.name)}</Text>
                          </View>
                          <Text style={[s.counselorName, { color: colors.onSurface }]} numberOfLines={2}>{c.name}</Text>
                          <Text style={[s.counselorSpec, { color: colors.onSurfaceVariant }]} numberOfLines={1}>{c.specialty}</Text>
                        </PressableScale>
                      );
                    })}
                  </ScrollView>
                </FadeIn>

                {/* ── Dates ── */}
                <FadeIn>
                  <Text style={[s.sectionLabel, { color: colors.onSurface }]}>Pilih tanggal</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hList} style={s.hScroll}>
                    {dates.map((d, i) => {
                      const active = selectedDay === i;
                      return (
                        <PressableScale
                          key={d.formatted}
                          onPress={() => { setSelectedDay(i); setSelectedSlot(null); }}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={d.long}
                          style={[s.dateChip, { backgroundColor: active ? colors.amber : colors.background, boxShadow: Neu.raisedSm }]}
                        >
                          <Text style={[s.dayLabel, { color: active ? colors.onPrimary : colors.onSurfaceVariant }]}>{d.day}</Text>
                          <Text style={[s.dateNum, { color: active ? colors.onPrimary : colors.onSurface }]}>{d.date}</Text>
                        </PressableScale>
                      );
                    })}
                  </ScrollView>
                </FadeIn>

                {/* ── Slots ── */}
                <FadeIn>
                  <Text style={[s.sectionLabel, { color: colors.onSurface }]}>Pilih waktu</Text>
                  {availableSlots.length === 0 ? (
                    <StateCard
                      face="berpikir"
                      title="Belum ada jadwal di hari ini"
                      body={`${selectedCounselor?.name ?? 'Konselor'} tidak membuka sesi pada ${selectedDate.long}.`}
                    >
                      {nextOpenDay > 0 ? (
                        <Button
                          label={`Lihat ${dates[nextOpenDay].long}`}
                          variant="secondary"
                          onPress={() => { setSelectedDay(nextOpenDay); setSelectedSlot(null); }}
                        />
                      ) : (
                        <Text style={[s.muted, { color: colors.onSurfaceVariant }]}>
                          Belum ada jadwal minggu ini. Coba pilih konselor lain.
                        </Text>
                      )}
                    </StateCard>
                  ) : (
                    <View style={s.slotsGrid}>
                      {availableSlots.map((slot) => {
                        const active = selectedSlot?.jadwal_id === slot.jadwal_id;
                        const label = `${hm(slot.waktu_mulai)}–${hm(slot.waktu_selesai)}`;
                        return (
                          <PressableScale
                            key={slot.jadwal_id}
                            onPress={() => setSelectedSlot(slot)}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={`Pukul ${label}`}
                            style={[s.slotChip, { backgroundColor: colors.background, boxShadow: active ? Neu.inset : Neu.raisedSm }]}
                          >
                            <Ionicons name="time-outline" size={16} color={active ? colors.amber : colors.onSurfaceVariant} />
                            <Text
                              style={[
                                s.slotText,
                                { color: active ? colors.amber : colors.onSurface, fontFamily: active ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_600SemiBold' },
                              ]}
                            >
                              {label}
                            </Text>
                          </PressableScale>
                        );
                      })}
                    </View>
                  )}
                </FadeIn>

                {/* ── CTA ── */}
                <FadeIn>
                  <Button
                    label={selectedSlot ? `Minta sesi ${hm(selectedSlot.waktu_mulai)}` : 'Pilih waktu dulu'}
                    onPress={handleBook}
                    loading={isBooking}
                    disabled={!selectedSlot}
                    accent={colors.amber}
                    icon={<Ionicons name="calendar-outline" size={18} color="#fff" />}
                  />
                </FadeIn>
              </>
            )}
          </>
        )}
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 24 },

  sectionLabel: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 12 },
  muted: { flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 21 },

  // Friendly states + intro share the "text left, character right" layout
  stateCard: { padding: 18, gap: 14 },
  intro: { padding: 18, gap: 16 },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stateTitle: { fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.3 },
  stateBody: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 21 },
  stateActions: { flexDirection: 'row', gap: 10 },

  steps: { flexDirection: 'row', gap: 8 },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  stepNum: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  stepText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', textAlign: 'center' },

  sessionCard: { padding: 18, gap: 14 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  dateBlock: { width: 60, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dateBlockDay: { fontSize: 24, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#1C2447', lineHeight: 28 },
  dateBlockMonth: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#1C2447' },
  sessionName: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold' },
  sessionMeta: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  statusText: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold' },

  // Horizontal lists need vertical padding or the shadows get clipped
  hScroll: { marginHorizontal: -20 },
  hList: { gap: 14, paddingHorizontal: 20, paddingVertical: 10 },

  counselorCard: { width: 150, padding: 16, borderRadius: 22, gap: 6 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  avatarText: { fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  counselorName: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },
  counselorSpec: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium' },

  dateChip: { width: 58, minHeight: 72, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 4 },
  dayLabel: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold' },
  dateNum: { fontSize: 19, fontFamily: 'PlusJakartaSans_800ExtraBold' },

  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  slotChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, paddingHorizontal: 14, borderRadius: 16 },
  slotText: { fontSize: 14 },
});
