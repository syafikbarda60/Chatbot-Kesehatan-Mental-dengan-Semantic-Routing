import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Modal, ActivityIndicator, Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { apiGetJadwalSaya, apiBuatJadwal, apiUpdateJadwalStatus, JadwalSlot } from '@prototype/api-client';

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
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  txt:  { fontSize: 12, fontWeight: '600' },
});

const fmtDate = (iso?: string | null) => {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

export default function ManageJadwalScreen() {
  const [jadwal, setJadwal] = useState<JadwalSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [addModal, setAddModal] = useState(false);
  const [formData, setFormData] = useState({ tanggal: '', waktu_mulai: '', waktu_selesai: '' });
  const [saving, setSaving] = useState(false);

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

  const handleAdd = async () => {
    if (!formData.tanggal || !formData.waktu_mulai || !formData.waktu_selesai) {
      alert('Mohon lengkapi semua form');
      return;
    }
    setSaving(true);
    try {
      await apiBuatJadwal(formData);
      setAddModal(false);
      setFormData({ tanggal: '', waktu_mulai: '', waktu_selesai: '' });
      load();
    } catch (e: any) {
      alert(e.message || 'Gagal membuat jadwal');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Batalkan jadwal ini?')) return;
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
          <Text style={s.pageEye}>MANAJEMEN KONSELING</Text>
          <Text style={s.pageTitle}>Atur Ketersediaan Jadwal</Text>
        </View>
        <View style={s.headerActions}>
          <Pressable onPress={load} style={(st: any) => [s.btn, s.btnOutline, st.hovered && { opacity: 0.7 }]}>
            <MaterialIcons name="refresh" size={18} color={C.primary} />
            <Text style={s.btnOutlineTxt}>Refresh</Text>
          </Pressable>
          <Pressable onPress={() => setAddModal(true)} style={(st: any) => [s.btn, s.btnPrimary, st.hovered && { opacity: 0.9 }]}>
            <MaterialIcons name="add" size={18} color={C.surface} />
            <Text style={s.btnPrimaryTxt}>Buat Jadwal Baru</Text>
          </Pressable>
        </View>
      </View>

      {/* Panel */}
      <View style={s.panel}>
        <View style={[s.tableRow, s.tableHead]}>
          <Text style={[s.th, { flex: 2 }]}>TANGGAL</Text>
          <Text style={[s.th, { flex: 2 }]}>WAKTU (MULAI - SELESAI)</Text>
          <Text style={[s.th, { flex: 1.5 }]}>STATUS</Text>
          <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>AKSI</Text>
        </View>

        {isLoading ? (
          <View style={s.center}><ActivityIndicator size="large" color={C.primary} /><Text style={s.centerTxt}>Memuat jadwal...</Text></View>
        ) : error ? (
          <View style={s.center}>
            <MaterialIcons name="error-outline" size={40} color={C.danger} />
            <Text style={[s.centerTxt, { color: C.danger }]}>{error}</Text>
          </View>
        ) : jadwal.length === 0 ? (
          <View style={s.center}>
            <MaterialIcons name="event-busy" size={40} color={C.textLight} />
            <Text style={s.centerTxt}>Belum ada jadwal yang dibuat.</Text>
          </View>
        ) : jadwal.map((j, i) => (
          <View key={j.jadwal_id} style={[s.tableRow, i % 2 === 0 && { backgroundColor: C.surfaceLow }]}>
            <View style={{ flex: 2 }}>
              <Text style={s.tdBold}>{fmtDate(j.tanggal)}</Text>
              <Text style={s.tdSub}>{j.tanggal}</Text>
            </View>
            <View style={{ flex: 2 }}>
              <Text style={s.tdBold}>{j.waktu_mulai} - {j.waktu_selesai}</Text>
            </View>
            <View style={{ flex: 1.5 }}>
              <StatusBadge status={j.status} />
            </View>
            <View style={[s.actionCell, { flex: 1 }]}>
              {j.status === 'tersedia' ? (
                <Pressable
                  style={(st: any) => [s.btnReject, st.hovered && { opacity: 0.85 }]}
                  onPress={() => handleCancel(j.jadwal_id)}
                >
                  <Text style={s.btnRejectTxt}>Batalkan</Text>
                </Pressable>
              ) : <Text style={s.tdSub}>—</Text>}
            </View>
          </View>
        ))}
      </View>

      {/* Add Modal */}
      <Modal visible={addModal} transparent animationType="fade">
        <View style={modal.overlay}>
          <View style={modal.card}>
            <Text style={modal.title}>Buat Jadwal Baru</Text>
            <Text style={modal.sub}>Tambahkan slot ketersediaan baru untuk mahasiswa.</Text>
            
            <Text style={modal.label}>Tanggal (YYYY-MM-DD)</Text>
            <TextInput
              style={modal.input}
              placeholder="Contoh: 2024-06-15"
              value={formData.tanggal}
              onChangeText={tanggal => setFormData(prev => ({ ...prev, tanggal }))}
            />

            <Text style={modal.label}>Waktu Mulai (HH:MM)</Text>
            <TextInput
              style={modal.input}
              placeholder="Contoh: 09:00"
              value={formData.waktu_mulai}
              onChangeText={waktu_mulai => setFormData(prev => ({ ...prev, waktu_mulai }))}
            />

            <Text style={modal.label}>Waktu Selesai (HH:MM)</Text>
            <TextInput
              style={modal.input}
              placeholder="Contoh: 10:30"
              value={formData.waktu_selesai}
              onChangeText={waktu_selesai => setFormData(prev => ({ ...prev, waktu_selesai }))}
            />

            <View style={modal.actions}>
              <Pressable style={(st: any) => [modal.btnCancel, st.hovered && { backgroundColor: C.surfaceLow }]}
                onPress={() => setAddModal(false)}>
                <Text style={modal.btnCancelTxt}>Batal</Text>
              </Pressable>
              <Pressable style={(st: any) => [modal.btnSave, st.hovered && { opacity: 0.85 }]}
                onPress={handleAdd} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={modal.btnSaveTxt}>Simpan Jadwal</Text>}
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
  headerActions: { flexDirection: 'row', gap: 12 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  btnOutline: { borderColor: C.border, backgroundColor: C.surface },
  btnOutlineTxt: { fontSize: 13, fontWeight: '600', color: C.primary },
  btnPrimary: { borderColor: C.primary, backgroundColor: C.primary },
  btnPrimaryTxt: { fontSize: 13, fontWeight: '600', color: C.surface },
  
  panel: { backgroundColor: C.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.border, shadowColor: '#2b3437', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 16, elevation: 2 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
  tableHead: { backgroundColor: C.surfaceLow, borderBottomWidth: 1, borderBottomColor: C.border },
  th: { fontSize: 11, fontWeight: '700', color: C.textLight, letterSpacing: 0.8, textTransform: 'uppercase' },
  tdBold: { fontSize: 14, fontWeight: '700', color: C.text },
  tdSub: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  actionCell: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center' },
  btnReject: { backgroundColor: C.dangerBg, paddingVertical: 7, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: C.danger + '40' },
  btnRejectTxt: { color: C.danger, fontSize: 13, fontWeight: '700' },
  center: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  centerTxt: { fontSize: 14, color: C.textLight, fontWeight: '500' },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 32, width: 400, maxWidth: '90%', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.2, shadowRadius: 40 },
  title: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 8 },
  sub: { fontSize: 14, color: C.textMuted, marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '600', color: C.textMuted, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, fontSize: 14, color: C.text, marginBottom: 16, outlineStyle: 'none' as any },
  actions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end', marginTop: 8 },
  btnCancel: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  btnCancelTxt: { fontSize: 14, fontWeight: '600', color: C.textMuted },
  btnSave: { backgroundColor: C.primary, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  btnSaveTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
