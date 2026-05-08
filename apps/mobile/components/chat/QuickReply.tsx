// components/chat/QuickReply.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Typography, Spacing, BorderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

interface Props { options: string[]; onSelect: (option: string) => void }

export const QuickReply: React.FC<Props> = ({ options, onSelect }) => {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {options.map((opt, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.chip, { borderColor: colors.primary + '50', backgroundColor: colors.primaryContainer + '30' }]}
            onPress={() => onSelect(opt)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, { color: colors.primary }]}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingBottom: Spacing.sm },
  row:  { paddingHorizontal: Spacing.base, gap: Spacing.sm, flexDirection: 'row' },
  chip: {
    borderWidth: 1.5,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 3,
  },
  chipText: { fontSize: Typography.sm, fontFamily: 'PlusJakartaSans_600SemiBold' },
});

export default QuickReply;
