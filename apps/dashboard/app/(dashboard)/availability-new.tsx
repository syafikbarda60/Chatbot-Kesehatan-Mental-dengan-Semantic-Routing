import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, ActivityIndicator, Animated
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { apiBuatJadwal } from '@prototype/api-client';

const C = {
  bg: '#f8f9fd', surface: '#ffffff', surfaceLow: '#f1f4f9', border: '#e4e8ef',
  primary: '#356385', primaryLight: '#eef3f8', onPrimary: '#f6f9ff',
  text: '#2b3437', textMuted: '#596067', textLight: '#8a9299',
  success: '#2e7d52', successBg: '#e8f5ee',
  warning: '#895900', warningBg: '#fff3e0',
  danger: '#9f403d', dangerBg: '#fff0f0',
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

// Slide and fade animation
const GlacialAnim = ({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: any }) => {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(slide, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),
    ]).start();
  }, [delay]);

  return (
    <Animated.View style={[{ opacity: fade, transform: [{ translateY: slide }] }, style]}>
      {children}
    </Animated.View>
  );
};

export default function TambahJadwalScreen() {
  const [formData, setFormData] = useState({ 
    tanggal: new Date().toISOString().split('T')[0], 
    waktu_mulai: '09:00', 
    waktu_selesai: '10:00' 
  });
  const [duration, setDuration] = useState(60);
  const [saving, setSaving] = useState(false);
  
  // Focus states
  const [dateFocused, setDateFocused] = useState(false);
  const [timeFocused, setTimeFocused] = useState(false);

  // Auto-calculate end time when start time or duration changes
  useEffect(() => {
    if (formData.waktu_mulai) {
      const [h, m] = formData.waktu_mulai.split(':').map(Number);
      const date = new Date();
      date.setHours(h, m + duration, 0);
      const endH = String(date.getHours()).padStart(2, '0');
      const endM = String(date.getMinutes()).padStart(2, '0');
      setFormData(prev => ({ ...prev, waktu_selesai: `${endH}:${endM}` }));
    }
  }, [formData.waktu_mulai, duration]);

  const handleSave = async () => {
    if (!formData.tanggal || !formData.waktu_mulai || !formData.waktu_selesai) {
      alert('Mohon lengkapi semua form');
      return;
    }
    setSaving(true);
    try {
      await apiBuatJadwal(formData);
      router.back();
    } catch (e: any) {
      alert(e.message || 'Gagal membuat jadwal');
    } finally {
      setSaving(false);
    }
  };

  const formattedDateString = (() => {
    try {
      return new Date(formData.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return formData.tanggal;
    }
  })();

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      {/* Header with Back Button */}
      <View style={s.header}>
        <View style={s.backBtnWrap}>
          <InteractiveBtn onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={20} color={C.text} />
          </InteractiveBtn>
        </View>
        <View>
          <Text style={s.pageEye}>Sistem Manajemen</Text>
          <Text style={s.pageTitle}>Tambah Jadwal Baru</Text>
        </View>
      </View>

      <View style={s.mainLayout}>
        {/* Form Section */}
        <GlacialAnim delay={0} style={s.formCardWrap}>
          <View style={s.formCard}>
            <Text style={s.cardTitle}>Detail Slot Ketersediaan</Text>
            <Text style={s.cardSub}>Tentukan tanggal dan jam Anda bersedia memberikan pelayanan konseling.</Text>

            <View style={s.formBody}>
              {/* Date Input */}
              <View style={s.formGroup}>
                <Text style={s.label}>Pilih Tanggal</Text>
                <View style={[s.inputContainer, dateFocused && s.inputContainerActive]}>
                  <MaterialIcons name="calendar-today" size={18} color={dateFocused ? C.primary : C.textLight} style={s.inputIcon} />
                  <TextInput
                    style={s.inputNative}
                    // @ts-ignore - type is web only
                    type="date"
                    value={formData.tanggal}
                    onChangeText={tanggal => setFormData(prev => ({ ...prev, tanggal }))}
                    onFocus={() => setDateFocused(true)}
                    onBlur={() => setDateFocused(false)}
                  />
                </View>
                <Text style={s.hint}>Tentukan hari sesi konsultasi.</Text>
              </View>

              <View style={s.row}>
                {/* Start Time */}
                <View style={[s.formGroup, { flex: 1 }]}>
                  <Text style={s.label}>Waktu Mulai</Text>
                  <View style={[s.inputContainer, timeFocused && s.inputContainerActive]}>
                    <MaterialIcons name="access-time" size={18} color={timeFocused ? C.primary : C.textLight} style={s.inputIcon} />
                    <TextInput
                      style={s.inputNative}
                      // @ts-ignore - type is web only
                      type="time"
                      value={formData.waktu_mulai}
                      onChangeText={waktu_mulai => setFormData(prev => ({ ...prev, waktu_mulai }))}
                      onFocus={() => setTimeFocused(true)}
                      onBlur={() => setTimeFocused(false)}
                    />
                  </View>
                </View>

                {/* Duration Presets */}
                <View style={[s.formGroup, { flex: 1.3 }]}>
                  <Text style={s.label}>Durasi Sesi</Text>
                  <View style={s.presetRow}>
                    {[30, 45, 60, 90].map(d => {
                      const active = duration === d;
                      return (
                        <View key={d} style={[s.presetBtn, active && s.presetBtnActive]}>
                          <InteractiveBtn onPress={() => setDuration(d)}>
                            <Text style={[s.presetTxt, active && s.presetTxtActive]}>{d}m</Text>
                          </InteractiveBtn>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* End Time (Auto-calculated) */}
              <View style={s.formGroup}>
                <Text style={s.label}>Waktu Selesai (Otomatis)</Text>
                <View style={[s.inputContainer, { backgroundColor: '#F1F4F9', borderColor: '#E2E8F0' }]}>
                  <MaterialIcons name="lock-outline" size={18} color={C.textLight} style={s.inputIcon} />
                  <TextInput
                    style={[s.inputNative, { color: C.textLight, fontWeight: '600' }]}
                    editable={false}
                    value={formData.waktu_selesai}
                  />
                </View>
                <View style={s.infoBox}>
                  <MaterialIcons name="info-outline" size={15} color={C.primary} />
                  <Text style={s.infoText}>Waktu selesai dihitung otomatis berdasarkan durasi {duration} menit.</Text>
                </View>
              </View>
            </View>

            <View style={s.footer}>
              <View style={s.btnCancel}>
                <InteractiveBtn onPress={() => router.back()}>
                  <Text style={s.btnCancelTxt}>Batal</Text>
                </InteractiveBtn>
              </View>
              
              <View style={s.btnSave}>
                <InteractiveBtn onPress={handleSave} disabled={saving}>
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <View style={s.btnInner}>
                      <MaterialIcons name="check" size={18} color="#fff" />
                      <Text style={s.btnSaveTxt}>Simpan Jadwal</Text>
                    </View>
                  )}
                </InteractiveBtn>
              </View>
            </View>
          </View>
        </GlacialAnim>

        {/* Tips / Summary Sidebar */}
        <View style={s.sideInfo}>
          <GlacialAnim delay={80}>
            <View style={s.tipCard}>
              <View style={s.tipHeader}>
                <MaterialIcons name="lightbulb-outline" size={20} color="#b27b00" />
                <Text style={s.tipTitle}>Tips Konselor</Text>
              </View>
              <Text style={s.tipText}>
                Berikan jeda minimal 15 menit antar sesi untuk mempersiapkan diri atau mencatat laporan asesmen sebelumnya.
              </Text>
            </View>
          </GlacialAnim>
          
          <GlacialAnim delay={160}>
            <View style={s.summaryCard}>
              <Text style={s.summaryTitle}>Ringkasan Sesi</Text>
              <View style={s.summaryDivider} />
              
              <View style={s.summaryRow}>
                <MaterialIcons name="event" size={16} color="rgba(255,255,255,0.7)" />
                <View>
                  <Text style={s.summaryLabel}>Hari / Tanggal</Text>
                  <Text style={s.summaryVal}>{formattedDateString}</Text>
                </View>
              </View>
              
              <View style={s.summaryRow}>
                <MaterialIcons name="access-time" size={16} color="rgba(255,255,255,0.7)" />
                <View>
                  <Text style={s.summaryLabel}>Waktu Sesi</Text>
                  <Text style={s.summaryVal}>{formData.waktu_mulai} s.d {formData.waktu_selesai} ({duration} menit)</Text>
                </View>
              </View>
            </View>
          </GlacialAnim>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 32, maxWidth: 1200, alignSelf: 'center', width: '100%', paddingBottom: 60 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 28 },
  backBtnWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    shadowColor: '#2b3437',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
  },
  pageEye: { fontSize: 12, fontWeight: '700', color: C.textLight, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5 },

  mainLayout: { flexDirection: 'row', gap: 28, flexWrap: 'wrap' },
  formCardWrap: { flexBasis: 600, flexGrow: 2 },
  formCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 32,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#2b3437',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 3,
  },
  cardTitle: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 8, letterSpacing: -0.3 },
  cardSub: { fontSize: 14, color: C.textMuted, marginBottom: 28, lineHeight: 20 },
  
  formBody: { gap: 20 },
  formGroup: { gap: 8 },
  label: { fontSize: 13, fontWeight: '700', color: C.text, marginLeft: 2 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FAFBFD',
    height: 48,
  },
  inputContainerActive: {
    borderColor: C.primary,
    backgroundColor: C.surface,
  },
  inputIcon: { marginRight: 10 },
  inputNative: { flex: 1, fontSize: 15, color: C.text, outlineStyle: 'none' as any, fontWeight: '500' },
  row: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  
  presetRow: { flexDirection: 'row', gap: 6, flex: 1 },
  presetBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  presetBtnActive: {
    borderColor: C.primary,
    backgroundColor: C.primaryLight,
  },
  presetTxt: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  presetTxtActive: { color: C.primary, fontWeight: '700' },
  
  hint: { fontSize: 12, color: C.textLight, marginLeft: 2 },
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.primaryLight, padding: 12, borderRadius: 10, marginTop: 4 },
  infoText: { fontSize: 12, color: C.primary, fontWeight: '600', flex: 1, lineHeight: 16 },

  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 14, marginTop: 32, paddingTop: 24, borderTopWidth: 1, borderTopColor: C.border },
  btnCancel: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    minWidth: 100,
  },
  btnCancelTxt: { fontSize: 14, fontWeight: '700', color: C.textMuted },
  btnSave: {
    height: 44,
    backgroundColor: C.primary,
    borderRadius: 10,
    overflow: 'hidden',
    minWidth: 160,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  btnSaveTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  sideInfo: { flexBasis: 300, flexGrow: 1, gap: 20 },
  tipCard: {
    backgroundColor: '#fffbf0',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ffe58f',
    gap: 8,
    borderLeftWidth: 5,
    borderLeftColor: '#d4b106',
  },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipTitle: { fontSize: 15, fontWeight: '800', color: '#b27b00' },
  tipText: { fontSize: 13, color: '#8c6b00', lineHeight: 20 },
  
  summaryCard: {
    backgroundColor: C.primary,
    padding: 24,
    borderRadius: 16,
    gap: 16,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
  summaryTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  summaryDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
  summaryRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  summaryLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryVal: { fontSize: 14, color: '#fff', fontWeight: '700', marginTop: 2, lineHeight: 18 },
});
