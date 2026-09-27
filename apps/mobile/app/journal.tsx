import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Neu } from '@prototype/ui-shared';
import { apiSaveJournal } from '@prototype/api-client';
import type { Expression } from '@prototype/utils';
import { NeuView, Button, ScreenHeader, goBack, useToast, Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui';
import { Companion } from '../components/chat';
import { MoodPicker } from '../components/MoodPicker';
import { Mood, MOOD_COMPANION, todayPrompt } from '../constants/moods';


export default function JournalScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const toast = useToast();

  const [content, setContent] = useState('');
  const [mood, setMood] = useState<Mood | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const prompt = todayPrompt();

  // Companion: greets with today's prompt, then follows the chosen mood; thumbs-up once saved
  const companion: { face: Expression; line: string } = saved
    ? { face: 'jempol', line: 'Tersimpan! Terima kasih sudah menulis hari ini.' }
    : mood
      ? { face: MOOD_COMPANION[mood].face, line: MOOD_COMPANION[mood].writing }
      : { face: content.trim() ? 'senang' : 'menyapa', line: content.trim() ? 'Aku dengerin. Lanjutkan saja.' : prompt };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await apiSaveJournal({ content: content.trim(), mood: mood as any });
      setSaved(true);
      toast.show('Jurnal tersimpan. Terima kasih sudah menulis hari ini.');
      setTimeout(goBack, 900); // let the thumbs-up play before leaving
    } catch (e: any) {
      toast.show(`Jurnal belum tersimpan: ${e.message || 'coba lagi sebentar.'}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Never silently throw away what the user wrote
  const handleDiscard = () => {
    if (!content.trim()) return goBack();
    setConfirmDiscard(true);
  };

  return (
    <KeyboardAvoidingView style={[s.root, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={[s.scroll, { paddingTop: insets.top + 16 }]} keyboardShouldPersistTaps="handled">
        <ScreenHeader back title="Tulis jurnal" subtitle={today} />

        {/* Companion keeps you company while writing */}
        <View style={s.companionRow}>
          <View style={[s.bubble, { backgroundColor: colors.background, boxShadow: Neu.raisedSm }]}>
            <Text style={[s.bubbleText, { color: colors.onSurface }]} accessibilityLiveRegion="polite">
              {companion.line}
            </Text>
          </View>
          <Companion expression={companion.face} size={124} />
        </View>

        <Text style={[s.label, { color: colors.onSurface }]}>Aku merasa…</Text>
        <MoodPicker value={mood} onChange={setMood} />

        <Text style={[s.label, { color: colors.onSurface, marginTop: 28 }]}>Ceritakan</Text>
        <NeuView inset radius={22}>
          <TextInput
            style={[s.input, { color: colors.onSurface }]}
            placeholder="Tulis dengan bebas, tidak ada yang menilai di sini."
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Isi jurnal"
            multiline
            value={content}
            onChangeText={setContent}
            textAlignVertical="top"
          />
        </NeuView>
        <Text style={[s.counter, { color: colors.textMuted }]}>{content.trim().length} karakter</Text>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button label="Batal" variant="ghost" onPress={handleDiscard} style={{ flex: 1 }} />
        <Button label="Simpan" accent={colors.sage} onPress={handleSave} loading={isLoading} disabled={!content.trim() || saved} style={{ flex: 2 }} />
      </View>
      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogHeader>
          <DialogTitle>Buang tulisan ini?</DialogTitle>
          <DialogDescription>Tulisanmu belum disimpan dan akan hilang.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button label="Lanjut menulis" variant="ghost" onPress={() => setConfirmDiscard(false)} style={{ flex: 1 }} />
          <Button label="Buang" variant="danger" onPress={() => { setConfirmDiscard(false); goBack(); }} style={{ flex: 1 }} />
        </DialogFooter>
      </Dialog>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 24 },
  companionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 },
  bubble: { flex: 1, padding: 14, borderRadius: 18, borderBottomRightRadius: 6 },
  bubbleText: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', lineHeight: 22 },
  label: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 12 },
  input: { minHeight: 240, padding: 18, fontSize: 17, lineHeight: 28, fontFamily: 'PlusJakartaSans_400Regular' },
  counter: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', textAlign: 'right', marginTop: 8 },
  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12 },
});
