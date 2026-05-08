// components/home/FeatureRow.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

export interface FeatureData {
  icon: string;
  label: string;
  desc: string;
}

export const FeatureRow: React.FC<FeatureData> = ({ icon, label, desc }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { borderColor: colors.border, backgroundColor: colors.primaryContainer + '30' }]}>
        <Ionicons name={icon as any} size={17} color={colors.primary} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
        <Text style={[styles.desc, { color: colors.textMuted }]}>{desc}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  iconWrap: {
    width: 36, height: 36,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  text:  { flex: 1, gap: 2 },
  label: { fontSize: Typography.base, fontFamily: 'PlusJakartaSans_600SemiBold' },
  desc:  { fontSize: Typography.sm, fontFamily: 'PlusJakartaSans_400Regular' },
});

export default FeatureRow;
