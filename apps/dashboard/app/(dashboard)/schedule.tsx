import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Modal, ActivityIndicator,
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
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  txt:  { fontSize: 12, fontWeight: '600' },
});

const fmtDate = (iso?: string | null) => {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
};

export default function ScheduleManagementScreen() {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
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
          <Text style={s.pageEye}>MANAJEMEN KONSELING</Text>
          <Text style={s.pageTitle}>Jadwal Konsultasi</Text>
        </View>
        <Pressable onPress={load} style={(st: any) => [s.refreshBtn, st.hovered && { opacity: 0.7 }]}>
          <MaterialIcons name="refresh" size={18} color={C.primary} />
          <Text style={s.refreshTxt}>Refresh</Text>
        </Pressable>
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        {[
          { label: 'Menunggu',     value: stats.menunggu,     color: C.warning, icon: 'schedule'     },
          { label: 'Dikonfirmasi', value: stats.dikonfirmasi, color: C.success, icon: 'check-circle' },
          { label: 'Dibatalkan',   value: stats.dibatalkan,   color: C.danger,  icon: 'cancel'       },
          { label: 'Total',        value: bookings.length,    color: C.primary, icon: 'event-note'   },
        ].map(st => (
          <View key={st.label} style={s.statCard}>
            <View style={[s.statIcon, { backgroundColor: st.color + '20' }]}>
              <MaterialIcons name={st.icon as any} size={20} color={st.color} />
            </View>
            <View>
              <Text style={s.statValue}>{isLoading ? '—' : st.value}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Panel */}
      <View style={s.panel}>
        {/* Toolbar */}
        <View style={s.toolbar}>
          <View style={s.searchWrap}>
            <MaterialIcons name="search" size={18} color={C.textLight} />
            <TextInput
              style={s.searchInput}
              placeholder="Cari mahasiswa, NIM, konselor..."
              placeholderTextColor={C.textLight}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <View style={s.filterRow}>
            {(['all', 'menunggu', 'dikonfirmasi', 'dibatalkan'] as StatusFilter[]).map(f => (
              <Pressable key={f} onPress={() => setFilterStatus(f)}
                style={[s.filterChip, filterStatus === f && s.filterChipActive]}>
                <Text style={[s.filterTxt, filterStatus === f && s.filterTxtActive]}>
                  {f === 'all' ? 'Semua' : statusMeta(f).label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Table head */}
        <View style={[s.tableRow, s.tableHead]}>
          <Text style={[s.th, { flex: 2 }]}>MAHASISWA</Text>
          <Text style={[s.th, { flex: 2 }]}>KONSELOR</Text>
          <Text style={[s.th, { flex: 2 }]}>JADWAL</Text>
          <Text style={[s.th, { flex: 1.5 }]}>STATUS</Text>
          <Text style={[s.th, { flex: 2, textAlign: 'center' }]}>AKSI</Text>
        </View>

        {/* State: loading / error / empty / rows */}
        {isLoading ? (
          <View style={s.center}><ActivityIndicator size="large" color={C.primary} /><Text style={s.centerTxt}>Memuat data...</Text></View>
        ) : error ? (
          <View style={s.center}>
            <MaterialIcons name="error-outline" size={40} color={C.danger} />
            <Text style={[s.centerTxt, { color: C.danger }]}>{error}</Text>
            <Pressable onPress={load} style={s.retryBtn}><Text style={s.retryTxt}>Coba Lagi</Text></Pressable>
          </View>
        ) : filtered.length === 0 ? (
          <View style={s.center}>
            <MaterialIcons name="event-busy" size={40} color={C.textLight} />
            <Text style={s.centerTxt}>Tidak ada data.</Text>
          </View>
        ) : filtered.map((b, i) => (
          <View key={b.booking_id} style={[s.tableRow, i % 2 === 0 && { backgroundColor: C.surfaceLow }]}>
            <View style={{ flex: 2 }}>
              <Text style={s.tdBold}>{b.mahasiswa.nama}</Text>
              <Text style={s.tdSub}>{b.mahasiswa.nim || b.mahasiswa.email || '-'}</Text>
            </View>
            <View style={{ flex: 2 }}>
              <Text style={s.td}>{b.konselor.nama}</Text>
            </View>
            <View style={{ flex: 2 }}>
              {b.jadwal ? (
                <>
                  <Text style={s.tdBold}>{fmtDate(b.jadwal.tanggal)}</Text>
                  <Text style={s.tdSub}>{b.jadwal.waktu_mulai}–{b.jadwal.waktu_selesai}</Text>
                </>
              ) : <Text style={s.tdSub}>-</Text>}
            </View>
            <View style={{ flex: 1.5 }}>
              <StatusBadge status={b.status} />
            </View>
            <View style={[s.actionCell, { flex: 2 }]}>
              {b.status === 'menunggu' ? (
                <>
                  <Pressable
                    style={(st: any) => [s.btnApprove, st.hovered && { opacity: 0.85 }]}
                    onPress={() => approve(b.booking_id)}
                    disabled={saving === b.booking_id}
                  >
                    {saving === b.booking_id
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={s.btnApproveTxt}>Setujui</Text>}
                  </Pressable>
                  <Pressable
                    style={(st: any) => [s.btnReject, st.hovered && { opacity: 0.85 }]}
                    onPress={() => setRejectModal({ open: true, id: b.booking_id, note: '' })}
                  >
                    <Text style={s.btnRejectTxt}>Tolak</Text>
                  </Pressable>
                </>
              ) : <Text style={s.tdSub}>—</Text>}
            </View>
          </View>
        ))}
      </View>

      {/* Reject Modal */}
      <Modal visible={rejectModal.open} transparent animationType="fade">
        <View style={modal.overlay}>
          <View style={modal.card}>
            <Text style={modal.title}>Tolak Permintaan</Text>
            <Text style={modal.sub}>Catatan penolakan (opsional).</Text>
            <TextInput
              style={modal.input}
              multiline numberOfLines={3}
              placeholder="Contoh: Jadwal penuh, mohon reschedule."
              placeholderTextColor={C.textLight}
              value={rejectModal.note}
              onChangeText={note => setRejectModal(prev => ({ ...prev, note }))}
            />
            <View style={modal.actions}>
              <Pressable style={(st: any) => [modal.btnCancel, st.hovered && { backgroundColor: C.surfaceLow }]}
                onPress={() => setRejectModal({ open: false, id: '', note: '' })}>
                <Text style={modal.btnCancelTxt}>Batal</Text>
              </Pressable>
              <Pressable style={(st: any) => [modal.btnReject, st.hovered && { opacity: 0.85 }]}
                onPress={rejectConfirm} disabled={!!saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={modal.btnRejectTxt}>Konfirmasi Tolak</Text>}
              </Pressable>
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
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 },
  pageEye: { fontSize: 11, fontWeight: '700', color: C.textLight, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  refreshTxt: { fontSize: 13, fontWeight: '600', color: C.primary },
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 28 },
  statCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.surface, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: C.border, shadowColor: '#2b3437', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  statIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 28, fontWeight: '800', color: C.text, lineHeight: 32 },
  statLabel: { fontSize: 12, fontWeight: '500', color: C.textMuted },
  panel: { backgroundColor: C.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.border, shadowColor: '#2b3437', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 16, elevation: 2 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderBottomWidth: 1, borderBottomColor: C.border, flexWrap: 'wrap' },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surfaceLow, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, minWidth: 220 },
  searchInput: { flex: 1, fontSize: 14, color: C.text, outlineStyle: 'none' as any },
  filterRow: { flexDirection: 'row', gap: 6 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: C.surfaceLow, borderWidth: 1, borderColor: C.border },
  filterChipActive: { backgroundColor: '#eef3f8', borderColor: C.primary },
  filterTxt: { fontSize: 13, fontWeight: '500', color: C.textMuted },
  filterTxtActive: { color: C.primary, fontWeight: '700' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
  tableHead: { backgroundColor: C.surfaceLow, borderBottomWidth: 1, borderBottomColor: C.border },
  th: { fontSize: 11, fontWeight: '700', color: C.textLight, letterSpacing: 0.8, textTransform: 'uppercase' },
  td: { fontSize: 14, color: C.text },
  tdBold: { fontSize: 14, fontWeight: '700', color: C.text },
  tdSub: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  actionCell: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center' },
  btnApprove: { backgroundColor: C.success, paddingVertical: 7, paddingHorizontal: 14, borderRadius: 8 },
  btnApproveTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnReject: { backgroundColor: C.dangerBg, paddingVertical: 7, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: C.danger + '40' },
  btnRejectTxt: { color: C.danger, fontSize: 13, fontWeight: '700' },
  center: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  centerTxt: { fontSize: 14, color: C.textLight, fontWeight: '500' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  retryTxt: { fontSize: 14, fontWeight: '600', color: C.primary },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 32, width: 460, maxWidth: '90%', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.2, shadowRadius: 40 },
  title: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 8 },
  sub: { fontSize: 14, color: C.textMuted, marginBottom: 20 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, fontSize: 14, color: C.text, textAlignVertical: 'top', minHeight: 90, marginBottom: 24, outlineStyle: 'none' as any },
  actions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  btnCancel: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  btnCancelTxt: { fontSize: 14, fontWeight: '600', color: C.textMuted },
  btnReject: { backgroundColor: C.danger, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  btnRejectTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
