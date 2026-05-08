import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';

interface Props {
  visible: boolean;
  stressLevel: number;
  onDismiss: () => void;
  onConfirmReport: () => void;
}

export const AlertModal: React.FC<Props> = ({ visible, stressLevel, onDismiss, onConfirmReport }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 240, useNativeDriver: true }),
      Animated.spring(scale, {
        toValue: visible ? 1 : 0.92,
        damping: 16,
        stiffness: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible]);

  const contacts = [
    { name: 'Into The Light', phone: '119 ext 8' },
    { name: 'Hotline Sehat Jiwa', phone: '1500-454' },
    { name: 'Yayasan Pulih', phone: '021-788-42580' },
  ];

  return (
    <Modal transparent visible={visible} onRequestClose={onDismiss} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.alertIconWrap}>
              <Ionicons name="warning-outline" size={24} color={Colors.stressHigh} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Perlu Perhatian</Text>
              <Text style={styles.headerSub}>Level stress {stressLevel}/10 terdeteksi</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Body */}
          <View style={styles.body}>
            <Text style={styles.bodyText}>
              Kamu tidak sendirian. Serenity mendeteksi kondisi yang mungkin memerlukan
              dukungan lebih. Berikut kontak yang bisa dihubungi:
            </Text>

            {contacts.map((c, i) => (
              <View key={i} style={styles.contactRow}>
                <Text style={styles.contactName}>{c.name}</Text>
                <Text style={styles.contactPhone}>{c.phone}</Text>
              </View>
            ))}

            <View style={styles.infoRow}>
              <Ionicons name="information-circle-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.infoText}>
                Data ini dapat dilaporkan ke tim Serenity untuk tindak lanjut.
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss} activeOpacity={0.7}>
              <Text style={styles.dismissText}>Nanti</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={onConfirmReport} activeOpacity={0.85}>
              <Text style={styles.confirmText}>Kirim ke Admin</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  alertIconWrap: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.stressHighBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.2)',
  },
  headerText: { flex: 1, gap: 2 },
  headerTitle: {
    fontSize: Typography.md,
    color: Colors.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
  },
  headerSub: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    fontFamily: 'Inter_400Regular',
  },
  divider: { height: 1, backgroundColor: Colors.border },
  body: { padding: Spacing.xl, gap: Spacing.md },
  bodyText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontFamily: 'Inter_400Regular',
    lineHeight: Typography.sm * 1.6,
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  contactName: {
    fontSize: Typography.sm,
    color: Colors.textPrimary,
    fontFamily: 'Inter_500Medium',
  },
  contactPhone: {
    fontSize: Typography.sm,
    color: Colors.stressLow,
    fontFamily: 'Inter_600SemiBold',
    fontVariant: ['tabular-nums'],
  },
  infoRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
    marginTop: Spacing.xs,
  },
  infoText: {
    flex: 1,
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontFamily: 'Inter_400Regular',
    lineHeight: Typography.xs * 1.6,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.xl,
    paddingTop: 0,
  },
  dismissBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  dismissText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontFamily: 'Inter_500Medium',
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.stressHigh,
    alignItems: 'center',
  },
  confirmText: {
    fontSize: Typography.sm,
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
  },
});

export default AlertModal;
