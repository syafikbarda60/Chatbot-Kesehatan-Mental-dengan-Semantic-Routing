import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Neu } from '@prototype/ui-shared';
import { FadeIn, NeuView, Button, ScreenHeader, useToast } from '../components/ui';
import { Companion } from '../components/chat';
import { MoodPicker } from '../components/MoodPicker';
import { apiUpdateJournal, apiDeleteJournal } from '@prototype/api-client';
import { Mood, moodOf, MOOD_COMPANION } from '../constants/moods';

export default function JournalDetailScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const toast = useToast();

  const params = useLocalSearchParams();
  const { journal_id, content: initialContent, mood: initialMood, created_at } = params as any;

  const [content, setContent] = useState<string>(initialContent || '');
  const [mood, setMood] = useState<Mood | null>((initialMood as Mood) || null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState<string>(initialContent || '');
  const [editMood, setEditMood] = useState<Mood | null>(mood);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const moodInfo = moodOf(mood);
  const companion = mood ? MOOD_COMPANION[mood] : null;
  const date = created_at ? new Date(created_at) : null;
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const readMin = Math.max(1, Math.round(words / 200));

  const startEdit = () => {
    setEditContent(content);
    setEditMood(mood);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!editContent.trim()) {
      toast.show('Catatan tidak boleh kosong.', 'info');
      return;
    }
    setIsSaving(true);
    try {
      await apiUpdateJournal(journal_id, { content: editContent.trim(), ...(editMood ? { mood: editMood } : {}) });
      setContent(editContent.trim());
      setMood(editMood);
      setIsEditing(false);
      toast.show('Perubahan jurnal disimpan.');
    } catch (e) {
      toast.show('Perubahan belum tersimpan. Coba lagi.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Hapus jurnal ini?', 'Jurnal yang dihapus tidak bisa dikembalikan.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          setIsDeleting(true);
          try {
            await apiDeleteJournal(journal_id);
            toast.show('Jurnal dihapus.', 'info');
            router.back();
          } catch (e) {
            toast.show('Jurnal belum terhapus. Coba lagi nanti.', 'error');
            setIsDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={[s.root, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader back title="Catatan jurnal" />

        {/* ── Hero: when, how you felt, and the companion looking back with you ── */}
        <FadeIn delay={0}>
          <NeuView radius={28} style={s.hero}>
            <View style={s.heroRow}>
              <View style={{ flex: 1, gap: 10 }}>
                {date && (
                  <View style={s.dateRow}>
                    <Text style={[s.dateDay, { color: colors.onSurface }]}>{date.getDate()}</Text>
                    <View>
                      <Text style={[s.dateMonth, { color: colors.onSurface }]}>
                        {date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                      </Text>
                      <Text style={[s.dateMeta, { color: colors.onSurfaceVariant }]}>
                        {date.toLocaleDateString('id-ID', { weekday: 'long' })}, {date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                )}
                {moodInfo && (
                  <View style={[s.moodChip, { backgroundColor: colors.background, boxShadow: Neu.inset }]}>
                    <Ionicons name={moodInfo.icon} size={16} color={moodInfo.color} />
                    <Text style={[s.moodChipText, { color: moodInfo.color }]}>Merasa {moodInfo.label.toLowerCase()}</Text>
                  </View>
                )}
              </View>
              <Companion expression={companion?.face ?? 'senang'} size={112} />
            </View>
            <Text style={[s.reflection, { color: colors.onSurfaceVariant }]}>
              {companion?.looking ?? 'Setiap catatan adalah jejak perjalananmu. Terima kasih sudah menuliskannya.'}
            </Text>
          </NeuView>
        </FadeIn>

        {/* ── The entry itself ── */}
        <FadeIn delay={80}>
          {isEditing ? (
            <View style={{ gap: 14 }}>
              <Text style={[s.sectionTitle, { color: colors.onSurface }]}>Suasana hati</Text>
              <MoodPicker value={editMood} onChange={setEditMood} />
              <Text style={[s.sectionTitle, { color: colors.onSurface, marginTop: 6 }]}>Isi catatan</Text>
              <NeuView inset radius={22}>
                <TextInput
                  style={[s.editInput, { color: colors.onSurface }]}
                  multiline
                  autoFocus
                  value={editContent}
                  onChangeText={setEditContent}
                  placeholder="Tuliskan isi jurnal…"
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel="Isi jurnal"
                  textAlignVertical="top"
                />
              </NeuView>
              <View style={s.row}>
                <Button label="Batal" variant="ghost" onPress={() => setIsEditing(false)} disabled={isSaving} style={{ flex: 1 }} />
                <Button label="Simpan perubahan" onPress={handleSave} loading={isSaving} style={{ flex: 2 }} />
              </View>
            </View>
          ) : (
            <NeuView inset radius={24} style={s.paper}>
              <View style={s.paperHead}>
                <Text style={[s.sectionTitle, { color: colors.onSurface }]}>Isi catatan</Text>
                <Text style={[s.paperMeta, { color: colors.onSurfaceVariant }]}>{words} kata · {readMin} menit baca</Text>
              </View>
              <View style={[s.paperRule, { backgroundColor: colors.outlineVariant }]} />
              {content.split('\n').filter((p) => p.trim()).map((paragraph, index) => (
                <Text key={index} style={[s.contentText, { color: colors.onSurface }]}>{paragraph}</Text>
              ))}
            </NeuView>
          )}
        </FadeIn>

        {!isEditing && (
          <>
            {/* ── Look back, then move forward ── */}
            <FadeIn delay={160}>
              <View style={{ gap: 12 }}>
                <View>
                  <Text style={[s.sectionTitle, { color: colors.onSurface }]}>Bagaimana perasaanmu sekarang?</Text>
                  <Text style={[s.sectionSub, { color: colors.onSurfaceVariant }]}>Bandingkan dengan hari itu, lalu lanjutkan.</Text>
                </View>
                <View style={s.row}>
                  {[
                    { icon: 'create-outline', label: 'Tulis jurnal baru', to: '/journal' },
                    { icon: 'chatbubble-ellipses-outline', label: 'Cerita ke Sajiwa', to: '/chat' },
                  ].map((a) => (
                    <Pressable
                      key={a.to}
                      onPress={() => router.push(a.to as any)}
                      accessibilityRole="button"
                      style={({ pressed }) => [s.tile, { backgroundColor: colors.background, boxShadow: pressed ? Neu.inset : Neu.raisedSm }]}
                    >
                      <Ionicons name={a.icon as any} size={22} color={colors.primary} />
                      <Text style={[s.tileText, { color: colors.onSurface }]}>{a.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </FadeIn>

            {/* ── Manage ── */}
            <FadeIn delay={220}>
              <View style={s.row}>
                <Button
                  label="Ubah"
                  variant="secondary"
                  onPress={startEdit}
                  style={{ flex: 1 }}
                  icon={<Ionicons name="pencil" size={16} color={colors.primary} />}
                />
                <Button
                  label="Hapus"
                  variant="ghost"
                  onPress={handleDelete}
                  loading={isDeleting}
                  style={{ flex: 1 }}
                  textStyle={{ color: colors.error }}
                  icon={<Ionicons name="trash-outline" size={16} color={colors.error} />}
                />
              </View>
            </FadeIn>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 24 },
  row: { flexDirection: 'row', gap: 12 },

  hero: { padding: 20, gap: 14 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateDay: { fontSize: 46, fontFamily: 'PlusJakartaSans_800ExtraBold', lineHeight: 50, letterSpacing: -1.5 },
  dateMonth: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', textTransform: 'capitalize' },
  dateMeta: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', textTransform: 'capitalize' },
  moodChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14 },
  moodChipText: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold' },
  reflection: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', lineHeight: 21 },

  sectionTitle: { fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.2 },
  sectionSub: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 },

  paper: { padding: 20, gap: 12 },
  paperHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  paperMeta: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium' },
  paperRule: { height: StyleSheet.hairlineWidth, opacity: 0.9 },
  contentText: { fontSize: 16, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 28 },

  tile: { flex: 1, minHeight: 84, borderRadius: 20, padding: 14, gap: 8, justifyContent: 'center' },
  tileText: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },

  editInput: { minHeight: 220, padding: 18, fontSize: 16, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 27 },
});
