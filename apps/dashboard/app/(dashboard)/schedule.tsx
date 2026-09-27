import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Modal, ActivityIndicator, Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { apiGetAdminBookings, apiUpdateBookingStatus, AdminBooking } from '@prototype/api-client';

const C = {
  bg: '#f8f9fd', surface: '#ffffff', surfaceLow: '#f1f4f9', border: '#e4e8ef',
  primary: '#356385', primaryLight: '#eef3f8', onPrimary: '#f6f9ff',
  text: '#2b3437', textMuted: '#596067', textLight: '#8a9299',
  success: '#2e7d52', successBg: '#e8f5ee',
  warning: '#895900', warningBg: '#fff3e0',
  danger: '#9f403d', dangerBg: '#fff0f0',
};

type StatusFilter = 'all' | 'menunggu' | 'dikonfirmasi' | 'dibatalkan';

const statusMeta = (s: string) => ({
  menunggu:     { label: 'Menunggu',   color: C.warning, bg: C.warningBg, icon: 'schedule'     },
  dikonfirmasi: { label: 'Dikonfirmasi', color: C.success, bg: C.successBg, icon: 'check-circle' },
  dibatalkan:   { label: 'Dibatalkan', color: C.danger,  bg: C.dangerBg,  icon: 'cancel'       },
  selesai:      { label: 'Selesai',    color: C.textMuted, bg: C.surfaceLow, icon: 'done-all'   },
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
  return new Date(iso).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
};

const getInitials = (name?: string | null) => {
  if (!name) return '??';
  const clean = name.replace(/^(Bapak|Ibu|Sdr|Sdri|dr|Prof|Dr)\.?\s+/i, '');
  const parts = clean.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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

export default function ScheduleManagementScreen() {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; id: string; note: string }>({ open: false, id: '', note: '' });

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiGetAdminBookings();
      setBookings(res.bookings);
    } catch (e: any) {
      setError(e.message || 'Gagal memuat data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async (id: string) => {
    setSaving(id);
    try {
      await apiUpdateBookingStatus(id, 'dikonfirmasi');
      setBookings(prev => prev.map(b => b.booking_id === id ? { ...b, status: 'dikonfirmasi' } : b));
    } catch (e: any) { alert(e.message); }
    finally { setSaving(null); }
  };

  const rejectConfirm = async () => {
    setSaving(rejectModal.id);
    try {
      await apiUpdateBookingStatus(rejectModal.id, 'dibatalkan');
      setBookings(prev => prev.map(b => b.booking_id === rejectModal.id ? { ...b, status: 'dibatalkan' } : b));
      setRejectModal({ open: false, id: '', note: '' });
    } catch (e: any) { alert(e.message); }
    finally { setSaving(null); }
  };

  const filtered = bookings.filter(b => {
    const matchStatus = filterStatus === 'all' || b.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      b.mahasiswa.nama.toLowerCase().includes(q) ||
      b.konselor.nama.toLowerCase().includes(q) ||
      (b.mahasiswa.nim || '').includes(q);
    return matchStatus && matchSearch;
  });

  const stats = {
    menunggu:     bookings.filter(b => b.status === 'menunggu').length,
    dikonfirmasi: bookings.filter(b => b.status === 'dikonfirmasi').length,
    dibatalkan:   bookings.filter(b => b.status === 'dibatalkan').length,
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.pageHeader}>
        <View>
          <Text style={s.pageEye}>Sistem Manajemen</Text>
          <Text style={s.pageTitle}>Penjadwalan Konsultasi</Text>
        </View>
        <Animated.View style={s.refreshBtnWrap}>
          <InteractiveBtn onPress={load} style={s.refreshBtnInner}>
            <View style={s.refreshRow}>
              <MaterialIcons name="refresh" size={16} color={C.primary} />
              <Text style={s.refreshTxt}>Segarkan</Text>
            </View>
          </InteractiveBtn>
        </Animated.View>
      </View>

      {/* Stats Cards */}
      <View style={s.statsRow}>
        {[
          { label: 'Menunggu Persetujuan', value: stats.menunggu,     color: C.warning, icon: 'pending-actions', desc: 'Perlu konfirmasi segera' },
          { label: 'Telah Dikonfirmasi',  value: stats.dikonfirmasi, color: C.success, icon: 'check-circle',    desc: 'Sesi aktif terdaftar' },
          { label: 'Dibatalkan',          value: stats.dibatalkan,   color: C.danger,  icon: 'cancel',          desc: 'Permintaan ditolak' },
          { label: 'Total Konsultasi',     value: bookings.length,    color: C.primary, icon: 'event-note',      desc: 'Seluruh riwayat sesi' },
        ].map((st, i) => (
          <GlacialAnim key={st.label} delay={i * 60} style={s.statCardWrap}>
            <View style={s.statCard}>
              <View style={[s.statIcon, { backgroundColor: st.color + '15' }]}>
                <MaterialIcons name={st.icon as any} size={22} color={st.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.statValue}>{isLoading ? '—' : st.value}</Text>
                <Text style={s.statLabel}>{st.label}</Text>
                <Text style={s.statDesc}>{st.desc}</Text>
              </View>
            </View>
          </GlacialAnim>
        ))}
      </View>

      {/* Main Panel */}
      <View style={s.panel}>
        {/* Toolbar */}
        <View style={s.toolbar}>
          <View style={[s.searchWrap, searchFocused && s.searchWrapActive]}>
            <MaterialIcons name="search" size={18} color={searchFocused ? C.primary : C.textLight} />
            <TextInput
              style={s.searchInput}
              placeholder="Cari nama mahasiswa, NIM, atau nama konselor..."
              placeholderTextColor={C.textLight}
              value={search}
              onChangeText={setSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
          </View>
          
          <View style={s.filterRow}>
            {(['all', 'menunggu', 'dikonfirmasi', 'dibatalkan'] as StatusFilter[]).map(f => {
              const active = filterStatus === f;
              return (
                <View key={f} style={[s.filterChip, active && s.filterChipActive]}>
                  <InteractiveBtn onPress={() => setFilterStatus(f)}>
                    <Text style={[s.filterTxt, active && s.filterTxtActive]}>
                      {f === 'all' ? 'Semua Status' : statusMeta(f).label}
                    </Text>
                  </InteractiveBtn>
                </View>
              );
            })}
          </View>
        </View>

        {/* Table Head (only labels) */}
        <View style={s.tableHead}>
          <Text style={[s.th, { flex: 2 }]}>Detail Mahasiswa</Text>
          <Text style={[s.th, { flex: 2 }]}>Konselor Pendamping</Text>
          <Text style={[s.th, { flex: 2.2 }]}>Jadwal Sesi</Text>
          <Text style={[s.th, { flex: 1.5 }]}>Status</Text>
          <Text style={[s.th, { flex: 2.3, textAlign: 'center' }]}>Tindakan</Text>
        </View>

        {/* Content Rows */}
        <View style={s.listContent}>
          {isLoading ? (
            <View style={s.center}>
              <ActivityIndicator size="large" color={C.primary} />
              <Text style={s.centerTxt}>Sinkronisasi data...</Text>
            </View>
          ) : error ? (
            <View style={s.center}>
              <MaterialIcons name="error-outline" size={44} color={C.danger} />
              <Text style={[s.centerTxt, { color: C.danger, fontWeight: '700' }]}>{error}</Text>
              <Pressable onPress={load} style={s.retryBtn}><Text style={s.retryTxt}>Coba Lagi</Text></Pressable>
            </View>
          ) : filtered.length === 0 ? (
            <View style={s.center}>
              <MaterialIcons name="event-busy" size={44} color={C.textLight} />
              <Text style={s.centerTxt}>Tidak ada jadwal konsultasi yang sesuai filter.</Text>
            </View>
          ) : (
            filtered.map((b, i) => (
              <GlacialAnim key={b.booking_id} delay={Math.min(i * 40, 250)}>
                <View style={[
                  s.cardRow,
                  { borderLeftColor: statusMeta(b.status).color }
                ]}>
                  {/* Mahasiswa Column */}
                  <View style={[s.col, { flex: 2 }]}>
                    <View style={s.profileCell}>
                      <View style={[s.avatarCircle, { backgroundColor: C.primary + '15' }]}>
                        <Text style={[s.avatarTxt, { color: C.primary }]}>
                          {getInitials(b.mahasiswa.nama)}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.tdBold} numberOfLines={1}>{b.mahasiswa.nama}</Text>
                        <Text style={s.tdSub} numberOfLines={1}>{b.mahasiswa.nim || b.mahasiswa.email || '-'}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Counselor Column */}
                  <View style={[s.col, { flex: 2 }]}>
                    <View style={s.profileCell}>
                      <View style={[s.avatarCircle, { backgroundColor: '#0ea5e915' }]}>
                        <Text style={[s.avatarTxt, { color: '#0ea5e9' }]}>
                          {getInitials(b.konselor.nama)}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.tdBold} numberOfLines={1}>{b.konselor.nama}</Text>
                        <Text style={s.tdSub} numberOfLines={1}>Konselor Spesialis</Text>
                      </View>
                    </View>
                  </View>

                  {/* Schedule Column */}
                  <View style={[s.col, { flex: 2.2 }]}>
                    <View style={s.dateTimeCell}>
                      <View style={s.dateIconWrap}>
                        <MaterialIcons name="event" size={16} color={C.primary} />
                      </View>
                      <View>
                        <Text style={s.tdBold}>{fmtDate(b.jadwal?.tanggal)}</Text>
                        <Text style={s.tdSub}>{b.jadwal ? `${b.jadwal.waktu_mulai} – ${b.jadwal.waktu_selesai}` : '-'}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Status Badge */}
                  <View style={[s.col, { flex: 1.5 }]}>
                    <StatusBadge status={b.status} />
                  </View>

                  {/* Actions Column */}
                  <View style={[s.actionCell, { flex: 2.3 }]}>
                    {b.status === 'menunggu' ? (
                      <View style={s.actionBtnContainer}>
                        <View style={s.btnApprove}>
                          <InteractiveBtn
                            onPress={() => approve(b.booking_id)}
                            disabled={saving === b.booking_id}
                          >
                            {saving === b.booking_id ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <View style={s.btnInner}>
                                <MaterialIcons name="check" size={14} color="#fff" />
                                <Text style={s.btnApproveTxt}>Setujui</Text>
                              </View>
                            )}
                          </InteractiveBtn>
                        </View>
                        
                        <View style={s.btnReject}>
                          <InteractiveBtn
                            onPress={() => setRejectModal({ open: true, id: b.booking_id, note: '' })}
                            disabled={saving === b.booking_id}
                          >
                            <View style={s.btnInner}>
                              <MaterialIcons name="close" size={14} color={C.danger} />
                              <Text style={s.btnRejectTxt}>Tolak</Text>
                            </View>
                          </InteractiveBtn>
                        </View>
                      </View>
                    ) : (
                      <Text style={s.actionDoneText}>Selesai diproses</Text>
                    )}
                  </View>
                </View>
              </GlacialAnim>
            ))
          )}
        </View>
      </View>

      {/* Reject Modal */}
      <Modal visible={rejectModal.open} transparent animationType="fade">
        <View style={modal.overlay}>
          <View style={modal.card}>
            <View style={modal.headerIconWrap}>
              <MaterialIcons name="error-outline" size={28} color={C.danger} />
            </View>
            <Text style={modal.title}>Tolak Permintaan Konsultasi</Text>
            <Text style={modal.sub}>Berikan alasan penolakan untuk dikirimkan kepada mahasiswa (opsional).</Text>
            
            <TextInput
              style={modal.input}
              multiline
              numberOfLines={3}
              placeholder="Contoh: Kuota jadwal konselor penuh, mohon pilih waktu lain."
              placeholderTextColor={C.textLight}
              value={rejectModal.note}
              onChangeText={note => setRejectModal(prev => ({ ...prev, note }))}
            />
            
            <View style={modal.actions}>
              <View style={modal.btnCancel}>
                <InteractiveBtn onPress={() => setRejectModal({ open: false, id: '', note: '' })}>
                  <Text style={modal.btnCancelTxt}>Batal</Text>
                </InteractiveBtn>
              </View>
              <View style={modal.btnReject}>
                <InteractiveBtn onPress={rejectConfirm} disabled={!!saving}>
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={modal.btnRejectTxt}>Konfirmasi Tolak</Text>
                  )}
                </InteractiveBtn>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 32, paddingBottom: 60 },
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  pageEye: { fontSize: 12, fontWeight: '700', color: C.textLight, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  
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
  refreshRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  refreshTxt: { fontSize: 13, fontWeight: '700', color: C.primary },
  
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 28, flexWrap: 'wrap' },
  statCardWrap: { flexBasis: 220, flexGrow: 1 },
  statCard: {
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
  statValue: { fontSize: 26, fontWeight: '800', color: C.text, lineHeight: 30, letterSpacing: -0.5 },
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
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexWrap: 'wrap',
    backgroundColor: '#FAFBFD',
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EDF1F7',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minWidth: 260,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  searchWrapActive: {
    borderColor: C.primary,
    backgroundColor: C.surface,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.text, outlineStyle: 'none' as any },
  
  filterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  filterChip: {
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EDF1F7',
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  filterChipActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  filterTxt: { fontSize: 13, fontWeight: '600', color: C.textMuted, paddingHorizontal: 14 },
  filterTxtActive: { color: '#ffffff', fontWeight: '700' },
  
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
  
  profileCell: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarCircle: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 13, fontWeight: '800' },
  
  td: { fontSize: 14, color: C.text },
  tdBold: { fontSize: 14, fontWeight: '700', color: C.text },
  tdSub: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  
  dateTimeCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateIconWrap: { width: 30, height: 30, borderRadius: 8, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  
  actionCell: { alignItems: 'center', justifyContent: 'center' },
  actionBtnContainer: { flexDirection: 'row', gap: 8, width: '100%', justifyContent: 'center' },
  btnApprove: {
    flex: 1,
    maxWidth: 100,
    height: 34,
    backgroundColor: C.success,
    borderRadius: 8,
    overflow: 'hidden',
  },
  btnApproveTxt: { color: '#fff', fontSize: 13, fontWeight: '700', marginLeft: 4 },
  btnReject: {
    flex: 1,
    maxWidth: 80,
    height: 34,
    backgroundColor: C.dangerBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.danger + '25',
    overflow: 'hidden',
  },
  btnRejectTxt: { color: C.danger, fontSize: 13, fontWeight: '700', marginLeft: 4 },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  
  actionDoneText: { fontSize: 13, fontWeight: '600', color: C.textLight },
  
  center: { alignItems: 'center', paddingVertical: 54, gap: 12 },
  centerTxt: { fontSize: 14, color: C.textLight, fontWeight: '600' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: C.border, marginTop: 8 },
  retryTxt: { fontSize: 14, fontWeight: '700', color: C.primary },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(27,38,49,0.5)', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)' as any },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    width: 460,
    maxWidth: '90%',
    shadowColor: '#1b2631',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    alignItems: 'center',
  },
  headerIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 8, textAlign: 'center' },
  sub: { fontSize: 14, color: C.textMuted, marginBottom: 20, textAlign: 'center', lineHeight: 20 },
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: C.text,
    textAlignVertical: 'top',
    minHeight: 100,
    marginBottom: 24,
    outlineStyle: 'none' as any,
    backgroundColor: '#FAFBFD',
  },
  actions: { flexDirection: 'row', gap: 12, width: '100%' },
  btnCancel: { flex: 1, height: 42, borderRadius: 10, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  btnCancelTxt: { fontSize: 14, fontWeight: '700', color: C.textMuted },
  btnReject: { flex: 1, height: 42, borderRadius: 10, backgroundColor: C.danger, overflow: 'hidden' },
  btnRejectTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
