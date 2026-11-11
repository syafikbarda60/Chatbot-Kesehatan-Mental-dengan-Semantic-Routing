import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Neu } from '@prototype/ui-shared';
import { BottomNav, BOTTOM_CLEARANCE, FadeIn, NeuView, Button, ScreenHeader, useToast, Calendar, longDate, toYmd, clockTime, haptic } from '../components/ui';
import { Companion } from '../components/chat';
import type { Expression } from '@prototype/utils';
// Counseling runs on the same request -> admin assignment flow as the dashboard: slots come
// from the availability admins set there, and a booking is a request an admin confirms.
import {
  apiGetKonselor, apiGetCounselingSlots, apiCreateCounselingRequest, ApiError, type CounselingSlot,
} from '@prototype/api-client';
import { PressableScale } from '../components/ui';
import { useUpcomingSession } from '../hooks/useUpcomingSession';

type Counselor = { id: string; name: string; specialty: string };

/** The phone-local calendar day a slot starts on. */
const dayOf = (iso: string) => toYmd(new Date(iso));
// How far ahead sessions are offered; the slots endpoint caps a request at 62 days.
const HORIZON_DAYS = 60;

const initials = (name: string) => name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const toast = useToast();

  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [slots, setSlots] = useState<CounselingSlot[]>([]);
  const { upcoming, reload: reloadUpcoming } = useUpcomingSession();
  const [selectedCounselor, setSelectedCounselor] = useState<Counselor | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<CounselingSlot | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const cRes = await apiGetKonselor();
      const mapped = cRes.users.map((u: any) => ({
        id: u.user_id,
        name: u.name,
        specialty: u.role === 'konselor' ? 'Konselor psikologi' : 'Layanan dukungan',
      }));
      setCounselors(mapped);
      setSelectedCounselor((cur) => cur ?? mapped[0] ?? null);
    } catch (err) {
      console.warn('Gagal memuat konselor', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Whose slots are on screen. A response for a counselor the student already tapped away
  // from is dropped, so a slow load can never color the calendar with the wrong person's days.
  const slotsFor = useRef<string | null>(null);
  const loadSlots = useCallback(async (counselorId: string) => {
    slotsFor.current = counselorId;
    setSlotsLoading(true);
    setSlotsError(false);
    const to = new Date();
    to.setDate(to.getDate() + HORIZON_DAYS);
    try {
      const res = await apiGetCounselingSlots(counselorId, toYmd(new Date()), toYmd(to));
      if (slotsFor.current === counselorId) setSlots(res.slots);
    } catch {
      // A card with a retry, not a toast: a toast re-renders its provider, which would hand
      // this callback a new `toast` and re-run the load in a loop while the server is down.
      if (slotsFor.current === counselorId) { setSlots([]); setSlotsError(true); }
    } finally {
      if (slotsFor.current === counselorId) setSlotsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCounselor) loadSlots(selectedCounselor.id);
  }, [selectedCounselor, loadSlots]);

  const today = toYmd(new Date());

  // The days the calendar colors in; every other day is grey and cannot be picked. The server
  // already returns only sessions still ahead, inside admin-set availability, not taken.
  const openDates = useMemo(() => new Set(slots.map((s) => dayOf(s.starts_at))), [slots]);

  // Land on the counselor's first open day, and move off a day that stopped being open (its
  // last slot was just booked, or another counselor was picked) instead of showing it empty.
  useEffect(() => {
    setSelectedDate((cur) => (cur && openDates.has(cur) ? cur : [...openDates].sort()[0] ?? null));
  }, [openDates]);

  // Already in time order from the server.
  const availableSlots = slots.filter((s) => dayOf(s.starts_at) === selectedDate);
  const nextOpenDate = [...openDates].filter((d) => d > (selectedDate ?? '')).sort()[0];

  const handleBook = async () => {
    if (!selectedSlot || !selectedCounselor) return;
    const counselorId = selectedCounselor.id;
    setIsBooking(true);
    try {
      await apiCreateCounselingRequest({
        preferred_counselor_id: counselorId,
        preferred_starts_at: selectedSlot.starts_at,
        preferred_ends_at: selectedSlot.ends_at,
      });
      // A request, not a booking yet: an admin confirms it from the dashboard queue.
      toast.show(`Permintaan sesi ${longDate(dayOf(selectedSlot.starts_at))}, ${clockTime(selectedSlot.starts_at)} terkirim. Tim Sajiwa akan mengonfirmasi, ya.`);
    } catch (e) {
      toast.show(
        e instanceof ApiError && e.status === 409
          ? 'Waktu itu baru saja diambil orang lain. Pilih waktu lain, ya.'
          : `Permintaan belum terkirim: ${(e as Error).message}`,
        'error',
      );
    } finally {
      setIsBooking(false);
      setSelectedSlot(null);
      // Either way the offer changed: the pick is now held for this student, or someone
      // else took it first.
      loadSlots(counselorId);
      reloadUpcoming();
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
    pending: { label: 'Menunggu konfirmasi', color: colors.stressMid, icon: 'time-outline' },
    confirmed: { label: 'Dikonfirmasi', color: '#3B7A56', icon: 'checkmark-circle-outline' },
  } as const;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + BOTTOM_CLEARANCE }]}
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
                      <Text style={s.dateBlockDay}>{new Date(upcoming.start).getDate()}</Text>
                      <Text style={s.dateBlockMonth}>
                        {new Date(upcoming.start).toLocaleDateString('id-ID', { month: 'short' })}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={[s.sessionName, { color: colors.onSurface }]} numberOfLines={1}>
                        {upcoming.counselor ?? 'Konselor kampus'}
                      </Text>
                      <Text style={[s.sessionMeta, { color: colors.onSurfaceVariant }]}>
                        {longDate(dayOf(upcoming.start))}, {clockTime(upcoming.start)}–{clockTime(upcoming.end)}
                      </Text>
                      <View style={s.statusRow}>
                        <Ionicons name={STATUS[upcoming.status].icon} size={14} color={STATUS[upcoming.status].color} />
                        <Text style={[s.statusText, { color: STATUS[upcoming.status].color }]}>
                          {STATUS[upcoming.status].label}
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
                          onPress={() => {
                            if (!active) haptic.select();
                            setSelectedCounselor(c);
                            setSelectedSlot(null);
                          }}
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
                  <View style={s.labelRow}>
                    <Text style={[s.sectionLabel, { color: colors.onSurface, marginBottom: 0 }]}>Pilih tanggal</Text>
                    {slotsLoading && <ActivityIndicator size="small" color={colors.amber} accessibilityLabel="Memuat jadwal konselor" />}
                  </View>
                  <NeuView radius={24} style={s.calendarCard}>
                    <Calendar
                      value={selectedDate}
                      onChange={(d) => { setSelectedDate(d); setSelectedSlot(null); }}
                      available={openDates}
                      minDate={today}
                    />
                  </NeuView>
                </FadeIn>

                {/* ── Slots ── */}
                <FadeIn>
                  <Text style={[s.sectionLabel, { color: colors.onSurface, marginBottom: selectedDate ? 2 : 12 }]}>
                    Pilih waktu
                  </Text>
                  {selectedDate && (
                    <Text style={[s.slotDate, { color: colors.onSurfaceVariant }]}>{longDate(selectedDate)}</Text>
                  )}
                  {slotsLoading ? (
                    // Nothing yet, rather than an empty-state card that flashes and vanishes.
                    <View style={s.slotsPlaceholder} />
                  ) : slotsError ? (
                    <StateCard face="bingung" title="Jadwal belum bisa dimuat" body="Periksa koneksi internetmu, lalu coba lagi.">
                      <Button
                        label="Coba lagi"
                        variant="secondary"
                        onPress={() => selectedCounselor && loadSlots(selectedCounselor.id)}
                      />
                    </StateCard>
                  ) : availableSlots.length === 0 ? (
                    <StateCard
                      face="berpikir"
                      title={selectedDate ? 'Belum ada jadwal di hari ini' : 'Belum ada jadwal terbuka'}
                      body={
                        selectedDate
                          ? `${selectedCounselor?.name ?? 'Konselor'} tidak membuka sesi pada ${longDate(selectedDate)}.`
                          : `${selectedCounselor?.name ?? 'Konselor'} belum membuka sesi dalam waktu dekat.`
                      }
                    >
                      {nextOpenDate ? (
                        <Button
                          label={`Lihat ${longDate(nextOpenDate)}`}
                          variant="secondary"
                          onPress={() => { haptic.select(); setSelectedDate(nextOpenDate); setSelectedSlot(null); }}
                        />
                      ) : (
                        <Text style={[s.muted, { color: colors.onSurfaceVariant }]}>
                          Coba pilih konselor lain, atau cerita dulu ke Sajiwa sambil menunggu.
                        </Text>
                      )}
                    </StateCard>
                  ) : (
                    <View style={s.slotsGrid}>
                      {availableSlots.map((slot) => {
                        const active = selectedSlot?.starts_at === slot.starts_at;
                        const label = `${clockTime(slot.starts_at)}–${clockTime(slot.ends_at)}`;
                        return (
                          <PressableScale
                            key={slot.starts_at}
                            onPress={() => { if (!active) haptic.select(); setSelectedSlot(slot); }}
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
                    label={selectedSlot ? `Minta sesi ${clockTime(selectedSlot.starts_at)}` : 'Pilih waktu dulu'}
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

  calendarCard: { padding: 16 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  slotsPlaceholder: { minHeight: 48 },
  slotDate: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', marginBottom: 12 },

  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  slotChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, paddingHorizontal: 14, borderRadius: 16 },
  slotText: { fontSize: 14 },
});
