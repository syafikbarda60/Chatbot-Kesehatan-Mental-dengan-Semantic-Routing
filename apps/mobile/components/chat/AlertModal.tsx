// components/chat/AlertModal.tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../ui';
import { Typography, Spacing, BorderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

interface Props {
  visible: boolean;
  stressLevel: number;
  onDismiss: () => void;
  onConfirmReport: () => void;
}

const CONTACTS = [
  { name: 'Into The Light', phone: '119 ext 8' },
  { name: 'Hotline Sehat Jiwa', phone: '1500-454' },
  { name: 'Yayasan Pulih', phone: '021-788-42580' },
];

export const AlertModal: React.FC<Props> = ({ visible, stressLevel, onDismiss, onConfirmReport }) => {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 240, useNativeDriver: true }),
      Animated.spring(scale,   { toValue: visible ? 1 : 0.92, damping: 16, stiffness: 200, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  return (
    <Modal transparent visible={visible} onRequestClose={onDismiss} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity, backgroundColor: colors.overlay }]}>
        <Animated.View style={[styles.card, { transform: [{ scale }], backgroundColor: colors.card, borderColor: colors.border }]}>

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.alertIcon, { backgroundColor: colors.stressHighBg }]}>
              <Ionicons name="warning-outline" size={22} color={colors.stressHigh} />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Perlu Perhatian</Text>
              <Text style={[styles.headerSub, { color: colors.textMuted }]}>Level stress {stressLevel}/10 terdeteksi</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Body */}
          <View style={styles.body}>
            <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
              Kamu tidak sendirian. Al Sahabat mendeteksi kondisi yang mungkin memerlukan
              dukungan lebih. Berikut kontak yang bisa dihubungi:
            </Text>

            {CONTACTS.map((c, i) => (
              <View key={i} style={[styles.contactRow, { borderBottomColor: colors.divider }]}>
                <Text style={[styles.contactName, { color: colors.textPrimary }]}>{c.name}</Text>
                <Text style={[styles.contactPhone, { color: colors.stressLow }]}>{c.phone}</Text>
              </View>
            ))}

            <View style={styles.infoRow}>
              <Ionicons name="information-circle-outline" size={13} color={colors.textMuted} />
              <Text style={[styles.infoText, { color: colors.textMuted }]}>
                Informasi ini dapat dilaporkan ke tim Al Sahabat untuk tindak lanjut.
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              label="Nanti"
              variant="secondary"
              onPress={onDismiss}
              style={{ flex: 1 }}
            />
            <Button
              label="Hubungi Admin"
              variant="danger"
              onPress={onConfirmReport}
              style={{ flex: 2 }}
            />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xl,
  },
  card: {
    borderRadius: BorderRadius.xxl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  alertIcon: {
    width: 42, height: 42,
    borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(194, 91, 91, 0.2)',
  },
  headerText: { flex: 1, gap: 2 },
  headerTitle: { fontSize: Typography.md, fontFamily: 'PlusJakartaSans_700Bold' },
  headerSub:   { fontSize: Typography.sm, fontFamily: 'PlusJakartaSans_400Regular' },
  divider:     { height: 1 },
  body:        { padding: Spacing.xl, gap: Spacing.md },
  bodyText: {
    fontSize: Typography.sm,
    fontFamily: 'PlusJakartaSans_400Regular', lineHeight: Typography.sm * 1.6,
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  contactName:  { fontSize: Typography.sm, fontFamily: 'PlusJakartaSans_600SemiBold' },
  contactPhone: { fontSize: Typography.sm, fontFamily: 'PlusJakartaSans_700Bold' },
  infoRow:  { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', marginTop: Spacing.xs },
  infoText: {
    flex: 1, fontSize: Typography.xs,
    fontFamily: 'PlusJakartaSans_400Regular', lineHeight: Typography.xs * 1.6,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.xl,
    paddingTop: 0,
  },
});

export default AlertModal;
