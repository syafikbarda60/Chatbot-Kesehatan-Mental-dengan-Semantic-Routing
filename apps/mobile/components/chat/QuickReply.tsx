import React from 'react';
import { Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Spacing, BorderRadius } from '@prototype/ui-shared';
import { useTheme, Neu } from '@prototype/ui-shared';

interface Props { options: string[]; onSelect: (option: string) => void }

export const QuickReply: React.FC<Props> = ({ options, onSelect }) => {
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[s.row, { paddingHorizontal: Spacing.md }]}
      style={s.wrap}
    >
      {options.map((opt, i) => (
        <Pressable
          key={i}
          style={({ pressed }) => [s.chip, { backgroundColor: colors.background, boxShadow: pressed ? Neu.inset : Neu.raisedSm }]}
          onPress={() => onSelect(opt)}
          accessibilityRole="button"
          accessibilityHint="Kirim sebagai pesan"
        >
          <Text style={[s.chipText, { color: colors.primary }]}>{opt}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
};

const s = StyleSheet.create({
  wrap: { flexGrow: 0 },
  row: { paddingVertical: 10, gap: Spacing.sm + 2, flexDirection: 'row', alignItems: 'center' },
  chip: {
    borderRadius: BorderRadius.full,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  chipText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    letterSpacing: 0.1,
  },
});

export default QuickReply;
