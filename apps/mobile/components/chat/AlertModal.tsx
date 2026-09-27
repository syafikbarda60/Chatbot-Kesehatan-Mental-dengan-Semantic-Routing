// components/chat/AlertModal.tsx
// Crisis support sheet. Calling a hotline is the primary action; every contact is one tap away.
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Pressable, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, IconButton } from '../ui';
import { Neu, useTheme } from '@prototype/ui-shared';
import { toDialable, extensionOf } from '@prototype/utils';

interface Props {
  visible: boolean;
  stressLevel: number;
  onDismiss: () => void;
  onConfirmReport: () => void;
}

const CONTACTS = [
  { name: 'Into The Light Indonesia', desc: 'Pencegahan bunuh diri', phone: '119 ext 8' },
  { name: 'Yayasan Pulih', desc: 'Dukungan psikologis', phone: '(021) 788-42580' },
  { name: 'IGD Rumah Sakit Terdekat', desc: 'Gawat darurat', phone: '118' },
];

export const callNumber = (display: string) => {
  const ext = extensionOf(display);
  const dial = () =>
    Linking.openURL(`tel:${toDialable(display)}`).catch(() =>
      Alert.alert('Tidak dapat menelepon', `Silakan hubungi ${display} secara manual.`),
    );
  // tel: can't carry an extension; tell the user before dialing
  if (ext) Alert.alert('Sebelum menelepon', `Setelah tersambung, minta disambungkan ke ekstensi ${ext}.`, [{ text: 'Telepon', onPress: dial }]);
  else dial();
};

export const AlertModal: React.FC<Props> = ({ visible, onDismiss, onConfirmReport }) => {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 200, useNativeDriver: true }),
      Animated.spring(scale, { toValue: visible ? 1 : 0.94, damping: 18, stiffness: 220, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  return (
    <Modal transparent visible={visible} onRequestClose={onDismiss} statusBarTranslucent animationType="none">
      <Animated.View style={[s.backdrop, { opacity, backgroundColor: colors.overlay }]}>
        <Animated.View
          accessibilityViewIsModal
          style={[s.card, { transform: [{ scale }], backgroundColor: colors.background, boxShadow: Neu.raised }]}
        >
          {/* Header */}
          <View style={s.headerRow}>
            <View style={[s.heartIcon, { backgroundColor: colors.background, boxShadow: Neu.inset }]}>
              <Ionicons name="heart" size={18} color={colors.stressHigh} />
            </View>
            <Text style={[s.title, { color: colors.onSurface }]} accessibilityRole="header">
              Kamu tidak sendirian
            </Text>
            <IconButton icon="close" label="Tutup" onPress={onDismiss} color={colors.onSurfaceVariant} size={36} />
          </View>
          <Text style={[s.body, { color: colors.onSurfaceVariant }]}>
            Hari ini terasa berat, ya. Bicara dengan seseorang bisa membantu. Mereka siap mendengarkan.
          </Text>

          {/* Contacts: whole row is the call button */}
          <View style={s.contacts}>
            {CONTACTS.map((c) => (
              <Pressable
                key={c.name}
                onPress={() => callNumber(c.phone)}
                accessibilityRole="button"
                accessibilityLabel={`Telepon ${c.name}, ${c.phone}`}
                style={({ pressed }) => [
                  s.contactRow,
                  { backgroundColor: colors.background, boxShadow: pressed ? Neu.inset : Neu.raisedSm },
                ]}
              >
                <View style={s.contactText}>
                  <Text style={[s.contactName, { color: colors.onSurface }]} numberOfLines={1}>{c.name}</Text>
                  <Text style={[s.contactMeta, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                    {c.phone} · {c.desc}
                  </Text>
                </View>
                <View style={[s.callIcon, { backgroundColor: colors.stressHigh }]}>
                  <Ionicons name="call" size={16} color="#fff" />
                </View>
              </Pressable>
            ))}
          </View>

          {/* Emergency note */}
          <View style={s.note}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.stressHigh} />
            <Text style={[s.noteText, { color: colors.onSurface }]}>
              Dalam bahaya sekarang? Hubungi <Text style={s.bold}>112</Text> atau <Text style={s.bold}>118</Text>.
            </Text>
          </View>

          {/* Secondary actions */}
          <View style={s.actions}>
            <Button label="Lanjut cerita" variant="ghost" onPress={onDismiss} style={s.actionBtn} textStyle={s.actionTxt} />
            <Button label="Kabari tim" variant="secondary" onPress={onConfirmReport} style={s.actionBtn} textStyle={s.actionTxt} />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 360, borderRadius: 24, padding: 18, gap: 12 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heartIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.4 },
  body: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 20 },

  contacts: { gap: 8 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 54,
    paddingLeft: 14,
    paddingRight: 8,
    borderRadius: 16,
  },
  contactText: { flex: 1, minWidth: 0 },
  contactName: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },
  contactMeta: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', marginTop: 1 },
  callIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },

  note: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noteText: { flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium' },
  bold: { fontFamily: 'PlusJakartaSans_800ExtraBold' },

  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, minHeight: 44, paddingVertical: 10, paddingHorizontal: 12 },
  actionTxt: { fontSize: 14 },
});

export default AlertModal;
