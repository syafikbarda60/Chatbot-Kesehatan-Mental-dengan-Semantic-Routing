// In-conversation pieces that replace dashboard-style widgets:
// a day divider, opening prompts on a fresh chat, and a support note that
// appears inside the thread only when the conversation turns heavy.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Neu } from '@prototype/ui-shared';
import { NeuView } from '../ui/NeuView';

export const DayDivider: React.FC<{ label: string }> = ({ label }) => {
  const { colors } = useTheme();
  return (
    <View style={s.divider} accessibilityRole="header">
      <View style={[s.divLine, { backgroundColor: colors.outlineVariant }]} />
      <Text style={[s.divText, { color: colors.onSurfaceVariant }]}>{label}</Text>
      <View style={[s.divLine, { backgroundColor: colors.outlineVariant }]} />
    </View>
  );
};

// Specific, human openers instead of generic chatbot chips
const OPENERS = [
  { icon: 'cloudy-outline', text: 'Aku lagi overthinking dan susah berhenti' },
  { icon: 'school-outline', text: 'Kuliah lagi berat banget belakangan ini' },
  { icon: 'chatbubble-outline', text: 'Aku cuma pengin cerita, nggak perlu solusi' },
];

export const OpeningPrompts: React.FC<{ onPick: (t: string) => void }> = ({ onPick }) => {
  const { colors } = useTheme();
  return (
    <View style={s.openers}>
      <Text style={[s.openersLabel, { color: colors.onSurfaceVariant }]}>Bingung mulai dari mana? Pilih salah satu:</Text>
      {OPENERS.map((o) => (
        <Pressable
          key={o.text}
          onPress={() => onPick(o.text)}
          accessibilityRole="button"
          accessibilityHint="Kirim sebagai pesan"
          style={({ pressed }) => [s.opener, { backgroundColor: colors.background, boxShadow: pressed ? Neu.inset : Neu.raisedSm }]}
        >
          <Ionicons name={o.icon as any} size={18} color={colors.primary} />
          <Text style={[s.openerText, { color: colors.onSurface }]}>{o.text}</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
        </Pressable>
      ))}
    </View>
  );
};

interface NoteProps {
  heavy: boolean;           // high tier: point to human help
  onPrimary: () => void;    // heavy: open support contacts; otherwise: open journal
  onDismiss: () => void;
}

export const SupportNote: React.FC<NoteProps> = ({ heavy, onPrimary, onDismiss }) => {
  const { colors } = useTheme();
  return (
    <NeuView inset radius={20} style={s.note}>
      <View style={s.noteHead}>
        <Ionicons name={heavy ? 'heart' : 'leaf-outline'} size={18} color={heavy ? colors.stressHigh : colors.primary} />
        <Text style={[s.noteTitle, { color: colors.onSurface }]}>
          {heavy ? 'Kamu tidak harus menghadapinya sendiri' : 'Sepertinya hari ini cukup berat'}
        </Text>
      </View>
      <Text style={[s.noteBody, { color: colors.onSurfaceVariant }]}>
        {heavy
          ? 'Ada orang yang siap mendengarkan dan membantu, kapan pun kamu butuh.'
          : 'Kadang menuliskannya membantu pikiran terasa lebih lega. Atau lanjut cerita di sini juga boleh.'}
      </Text>
      <View style={s.noteActions}>
        <Pressable
          onPress={onPrimary}
          accessibilityRole="button"
          style={({ pressed }) => [
            s.noteBtn,
            { backgroundColor: heavy ? colors.stressHigh : colors.primary },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={s.noteBtnPrimaryText}>{heavy ? 'Lihat kontak bantuan' : 'Tulis di jurnal'}</Text>
        </Pressable>
        <Pressable onPress={onDismiss} accessibilityRole="button" style={s.noteBtnGhost}>
          <Text style={[s.noteBtnGhostText, { color: colors.onSurfaceVariant }]}>Lanjut cerita</Text>
        </Pressable>
      </View>
    </NeuView>
  );
};

const s = StyleSheet.create({
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, marginTop: 8, marginBottom: 18 },
  divLine: { flex: 1, height: StyleSheet.hairlineWidth, opacity: 0.8 },
  divText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold' },

  openers: { paddingHorizontal: 16, gap: 10, marginBottom: 18 },
  openersLabel: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', marginBottom: 2, paddingHorizontal: 4 },
  opener: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 16, borderRadius: 18 },
  openerText: { flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', lineHeight: 20 },

  note: { marginHorizontal: 16, marginBottom: 18, padding: 16, gap: 8 },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noteTitle: { flex: 1, fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold' },
  noteBody: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 21 },
  noteActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  noteBtn: { minHeight: 44, paddingHorizontal: 16, borderRadius: 14, justifyContent: 'center' },
  noteBtnPrimaryText: { color: '#fff', fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },
  noteBtnGhost: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  noteBtnGhostText: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
});
