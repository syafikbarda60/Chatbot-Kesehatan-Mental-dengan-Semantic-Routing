import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, Animated
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { apiGetJadwalSaya, apiUpdateJadwalStatus, JadwalSlot } from '@prototype/api-client';

const C = {
  bg: '#f8f9fd', surface: '#ffffff', surfaceLow: '#f1f4f9', border: '#e4e8ef',
  primary: '#356385', primaryLight: '#eef3f8', onPrimary: '#f6f9ff',
  text: '#2b3437', textMuted: '#596067', textLight: '#8a9299',
  success: '#2e7d52', successBg: '#e8f5ee',
  warning: '#895900', warningBg: '#fff3e0',
  danger: '#9f403d', dangerBg: '#fff0f0',
};

const statusMeta = (s: string) => ({
  tersedia:   { label: 'Tersedia',   color: C.success, bg: C.successBg, icon: 'event-available' },
  dipesan:    { label: 'Dipesan',    color: C.warning, bg: C.warningBg, icon: 'event-seat'      },
  selesai:    { label: 'Selesai',    color: C.textMuted, bg: C.surfaceLow, icon: 'done-all'     },
  dibatalkan: { label: 'Dibatalkan', color: C.danger,  bg: C.dangerBg,  icon: 'cancel'          },
}[s] || { label: s, color: C.textMuted, bg: C.surfaceLow, icon: 'info' });

function StatusBadge({ status }: { status: string }) {
  const m = statusMeta(status);
  return (
    <View style={[badge.wrap, { backgroundColor: m.bg }]}>
      <MaterialIcons name={m.icon as any} size={13} color={m.color} />
      <Text style={[badge.txt, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  txt: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});

const fmtDate = (iso?: string | null) => {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

// Micro-interaction press animation wrapper
const InteractiveBtn = ({ children, style, onPress, disabled }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  
  const press = () => {
    if (disabled) return;
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 25, bounciness: 0 }).start();
  };
  
  const release = () => {
    if (disabled) return;
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 25, bounciness: 4 }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPressIn={press}
        onPressOut={release}
        onPress={onPress}
        disabled={disabled}
        style={(state: any) => [
          { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
          state.hovered && { opacity: 0.9 }
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

// Staggered slide and fade-in animation
const GlacialAnim = ({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: any }) => {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slide, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, [delay]);

  return (
    <Animated.View style={[{ opacity: fade, transform: [{ translateY: slide }] }, style]}>
      {children}
    </Animated.View>
  );
};

export default function ManageJadwalScreen() {
  const [jadwal, setJadwal] = useState<JadwalSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiGetJadwalSaya();
      setJadwal(res.jadwal || []);
    } catch (e: any) {
      setError(e.message || 'Gagal memuat jadwal');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAddNavigation = () => {
    router.push('/(dashboard)/availability-new');
  };

  const handleCancel = async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Batalkan jadwal ketersediaan ini?')) return;
    try {
      await apiUpdateJadwalStatus(id, 'dibatalkan');
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.pageHeader}>
        <View>
          <Text style={s.pageEye}>Sistem Manajemen</Text>
          <Text style={s.pageTitle}>Ketersediaan Jadwal</Text>
        </View>
        <View style={s.headerActions}>
          <Animated.View style={s.refreshBtnWrap}>
            <InteractiveBtn onPress={load} style={s.refreshBtnInner}>
              <View style={s.btnRow}>
                <MaterialIcons name="refresh" size={16} color={C.primary} />
                <Text style={s.refreshTxt}>Segarkan</Text>
              </View>
            </InteractiveBtn>
          </Animated.View>
          
          <Animated.View style={s.createBtnWrap}>
            <InteractiveBtn onPress={handleAddNavigation}>
              <View style={s.btnRow}>
                <MaterialIcons name="add" size={18} color="#fff" />
                <Text style={s.createTxt}>Jadwal Baru</Text>
              </View>
            </InteractiveBtn>
          </Animated.View>
        </View>
      </View>

      {/* Stats Summary Bento Grid */}
      <View style={s.statsSummary}>
        {[
          { label: 'Total Slot Terdaftar', value: jadwal.length, color: C.primary, icon: 'date-range', desc: 'Seluruh ketersediaan sesi' },
          { label: 'Slot Tersedia', value: jadwal.filter(j => j.status === 'tersedia').length, color: C.success, icon: 'event-available', desc: 'Siap dipesan mahasiswa' },
          { label: 'Slot Telah Dipesan', value: jadwal.filter(j => j.status === 'dipesan').length, color: C.warning, icon: 'event-seat', desc: 'Menunggu waktu sesi dimulai' },
        ].map((st, i) => (
          <GlacialAnim key={st.label} delay={i * 60} style={s.statCardWrap}>
            <View style={s.statBox}>
              <View style={[s.statIcon, { backgroundColor: st.color + '15' }]}>
                <MaterialIcons name={st.icon as any} size={22} color={st.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.statVal}>{isLoading ? '—' : st.value}</Text>
                <Text style={s.statLabel}>{st.label}</Text>
                <Text style={s.statDesc}>{st.desc}</Text>
              </View>
            </View>
          </GlacialAnim>
        ))}
      </View>

      {/* List Panel */}
      <View style={s.panel}>
        {/* Table Head */}
        <View style={s.tableHead}>
          <Text style={[s.th, { flex: 2.2 }]}>Tanggal & Waktu Sesi</Text>
          <Text style={[s.th, { flex: 1.5 }]}>Durasi Konsultasi</Text>
          <Text style={[s.th, { flex: 1.5 }]}>Status Slot</Text>
          <Text style={[s.th, { flex: 1.2, textAlign: 'center' }]}>Tindakan</Text>
        </View>

        {/* Content Rows */}
        <View style={s.listContent}>
          {isLoading ? (
            <View style={s.center}>
              <ActivityIndicator size="large" color={C.primary} />
              <Text style={s.centerTxt}>Sinkronisasi jadwal...</Text>
            </View>
          ) : error ? (
            <View style={s.center}>
              <MaterialIcons name="error-outline" size={44} color={C.danger} />
              <Text style={[s.centerTxt, { color: C.danger, fontWeight: '700' }]}>{error}</Text>
            </View>
          ) : jadwal.length === 0 ? (
            <View style={s.center}>
              <MaterialIcons name="event-busy" size={44} color={C.textLight} />
              <Text style={s.centerTxt}>Belum ada ketersediaan jadwal yang Anda buat.</Text>
            </View>
          ) : (
            jadwal.map((j, i) => {
              const durationMins = (() => {
                const start = j.waktu_mulai.split(':').map(Number);
                const end = j.waktu_selesai.split(':').map(Number);
                return (end[0] * 60 + end[1]) - (start[0] * 60 + start[1]);
              })();

              return (
                <GlacialAnim key={j.jadwal_id} delay={Math.min(i * 40, 250)}>
                  <View style={[
                    s.cardRow,
                    { borderLeftColor: statusMeta(j.status).color }
                  ]}>
                    {/* Date/Time Column */}
                    <View style={[s.col, { flex: 2.2 }]}>
                      <View style={s.dateTimeCell}>
                        <View style={s.dateIconWrap}>
                          <MaterialIcons name="event" size={16} color={C.primary} />
                        </View>
                        <View>
                          <Text style={s.tdBold}>{fmtDate(j.tanggal)}</Text>
                          <View style={s.timeRow}>
                            <MaterialIcons name="access-time" size={14} color={C.textMuted} />
                            <Text style={s.tdSub}>{j.waktu_mulai} – {j.waktu_selesai}</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Duration Column */}
                    <View style={[s.col, { flex: 1.5 }]}>
                      <View style={s.durationCell}>
                        <MaterialIcons name="timer" size={16} color={C.textMuted} />
                        <Text style={s.tdSubBold}>{durationMins} Menit</Text>
                      </View>
                    </View>

                    {/* Status Badge */}
                    <View style={[s.col, { flex: 1.5 }]}>
                      <StatusBadge status={j.status} />
                    </View>

                    {/* Actions Column */}
                    <View style={[s.actionCell, { flex: 1.2 }]}>
                      {j.status === 'tersedia' ? (
                        <View style={s.btnReject}>
                          <InteractiveBtn onPress={() => handleCancel(j.jadwal_id)}>
                            <View style={s.btnInner}>
                              <MaterialIcons name="cancel" size={14} color={C.danger} />
                              <Text style={s.btnRejectTxt}>Batalkan</Text>
                            </View>
                          </InteractiveBtn>
                        </View>
                      ) : (
                        <Text style={s.actionDoneText}>—</Text>
                      )}
                    </View>
                  </View>
                </GlacialAnim>
              );
            })
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 32, paddingBottom: 60 },
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  pageEye: { fontSize: 12, fontWeight: '700', color: C.textLight, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', gap: 12 },
  
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  refreshBtnWrap: {
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    overflow: 'hidden',
    shadowColor: '#2b3437',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
  },
  refreshBtnInner: {
    paddingHorizontal: 16,
    height: '100%',
  },
  refreshTxt: { fontSize: 13, fontWeight: '700', color: C.primary },
  
  createBtnWrap: {
    height: 38,
    borderRadius: 10,
    backgroundColor: C.primary,
    overflow: 'hidden',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  createTxt: { fontSize: 13, fontWeight: '700', color: '#fff', paddingHorizontal: 16 },

  statsSummary: { flexDirection: 'row', gap: 16, marginBottom: 28, flexWrap: 'wrap' },
  statCardWrap: { flexBasis: 240, flexGrow: 1 },
  statBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#2b3437',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  statIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statVal: { fontSize: 26, fontWeight: '800', color: C.text, lineHeight: 30, letterSpacing: -0.5 },
  statLabel: { fontSize: 13, fontWeight: '700', color: C.text, marginTop: 2 },
  statDesc: { fontSize: 11, color: C.textMuted, marginTop: 1 },

  panel: {
    backgroundColor: C.surface,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#2b3437',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 2,
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#F1F4F9',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  th: { fontSize: 11, fontWeight: '800', color: C.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
  
  listContent: { padding: 16, backgroundColor: C.surface },
  
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 5,
    shadowColor: '#2b3437',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
  },
  col: { justifyContent: 'center' },
  
  dateTimeCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateIconWrap: { width: 30, height: 30, borderRadius: 8, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  
  durationCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  
  tdBold: { fontSize: 14, fontWeight: '700', color: C.text },
  tdSub: { fontSize: 12, color: C.textMuted },
  tdSubBold: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  
  actionCell: { alignItems: 'center', justifyContent: 'center' },
  btnReject: {
    width: '100%',
    maxWidth: 100,
    height: 34,
    backgroundColor: C.dangerBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.danger + '25',
    overflow: 'hidden',
  },
  btnRejectTxt: { color: C.danger, fontSize: 12, fontWeight: '700', marginLeft: 4 },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  actionDoneText: { fontSize: 13, fontWeight: '600', color: C.textLight },
  
  center: { alignItems: 'center', paddingVertical: 54, gap: 12 },
  centerTxt: { fontSize: 14, color: C.textLight, fontWeight: '600' },
});
