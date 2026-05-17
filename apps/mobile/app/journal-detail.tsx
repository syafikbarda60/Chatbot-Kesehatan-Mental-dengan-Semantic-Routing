import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@prototype/ui-shared';
import { FadeIn } from '../components/ui';
import { apiUpdateJournal, apiDeleteJournal } from '@prototype/api-client';

export default function JournalDetailScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  
  const params = useLocalSearchParams();
  const { journal_id, content: initialContent, mood, created_at } = params as any;

  const [content, setContent] = useState(initialContent || '');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(initialContent || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatDate = (isoStr: string) => {
    if (!isoStr) return '';
    return new Date(isoStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      weekday: 'long',
    });
  };

  const getMoodConfig = (m: string) => {
    switch (m) {
      case 'Calm': return { icon: 'water-outline', bg: '#E3F2FD', color: '#1976D2' };
      case 'Anxious': return { icon: 'pulse-outline', bg: '#FFEBEE', color: '#D32F2F' };
      case 'Focused': return { icon: 'locate-outline', bg: '#E8F5E9', color: '#388E3C' };
      case 'Tired': return { icon: 'moon-outline', bg: '#F3E5F5', color: '#7B1FA2' };
      default: return { icon: 'leaf-outline', bg: colors.surfaceContainerLow, color: colors.primary };
    }
  };

  const moodConfig = getMoodConfig(mood);

  const handleSave = async () => {
    if (!editContent.trim()) {
      Alert.alert('Error', 'Jurnal tidak boleh kosong.');
      return;
    }
    setIsSaving(true);
    try {
      await apiUpdateJournal(journal_id, { content: editContent.trim() });
      setContent(editContent.trim());
      setIsEditing(false);
    } catch (e) {
      Alert.alert('Error', 'Gagal menyimpan jurnal.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Hapus Jurnal', 'Apakah Anda yakin ingin menghapus jurnal ini?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: async () => {
        setIsDeleting(true);
        try {
          await apiDeleteJournal(journal_id);
          router.back();
        } catch (e) {
          Alert.alert('Error', 'Gagal menghapus jurnal.');
          setIsDeleting(false);
        }
      }}
    ]);
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={28} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.onSurface }]}>Momen Jurnal</Text>
        <View style={s.headerActions}>
          {isDeleting ? (
            <ActivityIndicator size="small" color={colors.error} />
          ) : !isEditing ? (
            <>
              <TouchableOpacity onPress={() => { setIsEditing(true); setEditContent(content); }} style={s.actionBtn}>
                <Ionicons name="pencil" size={22} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={s.actionBtn}>
                <Ionicons name="trash-outline" size={22} color={colors.error} />
              </TouchableOpacity>
            </>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <FadeIn delay={100}>
          {/* Mood & Date Card */}
          <View style={[s.topCard, { backgroundColor: colors.surfaceContainerLowest }]}>
            <View style={[s.moodIconWrapper, { backgroundColor: moodConfig.bg }]}>
              <Ionicons name={moodConfig.icon as any} size={32} color={moodConfig.color} />
            </View>
            <View style={{ alignItems: 'center', marginTop: 16 }}>
              <Text style={[s.dateText, { color: colors.onSurface }]}>{formatDate(created_at)}</Text>
              {mood && (
                <Text style={[s.moodText, { color: moodConfig.color }]}>Merasa {mood}</Text>
              )}
            </View>
          </View>
        </FadeIn>

        <FadeIn delay={200}>
          {/* Journal Content Area */}
          <View style={[s.contentWrapper, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
            <View style={{ marginTop: 0 }}>
              {isEditing ? (
                <View>
                  <TextInput
                    style={[s.editInput, { color: colors.onSurface, backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}
                    multiline
                    value={editContent}
                    onChangeText={setEditContent}
                    placeholder="Tuliskan isi jurnal..."
                    placeholderTextColor={colors.outline}
                  />
                  <View style={s.editActions}>
                    <TouchableOpacity 
                      style={[s.cancelBtn, { borderColor: colors.outlineVariant }]} 
                      onPress={() => setIsEditing(false)}
                      disabled={isSaving}
                    >
                      <Text style={[s.cancelBtnTxt, { color: colors.onSurfaceVariant }]}>Batal</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[s.saveBtn, { backgroundColor: colors.primary }]} 
                      onPress={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <Text style={[s.saveBtnTxt, { color: colors.onPrimary }]}>Simpan</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                content?.split('\n').map((paragraph: string, index: number) => (
                  <Text key={index} style={[s.contentText, { color: colors.onSurface }]}>
                    {paragraph}
                  </Text>
                ))
              )}
            </View>
          </View>
        </FadeIn>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#00000008',
  },
  backBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold' },
  headerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', width: 80, gap: 8 },
  actionBtn: { padding: 8 },
  scroll: { padding: 24, paddingBottom: 60 },
  
  topCard: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 24,
    shadowColor: '#2b3437',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
    marginBottom: 24,
  },
  moodIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: { 
    fontSize: 16, 
    fontFamily: 'PlusJakartaSans_800ExtraBold', 
    marginBottom: 4 
  },
  moodText: { 
    fontSize: 14, 
    fontFamily: 'PlusJakartaSans_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  contentWrapper: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    minHeight: 200,
    shadowColor: '#2b3437',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  contentText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_400Regular',
    lineHeight: 28,
    marginBottom: 16,
  },
  
  editInput: {
    minHeight: 150,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_400Regular',
    lineHeight: 28,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelBtnTxt: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  saveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: 90,
    alignItems: 'center',
  },
  saveBtnTxt: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
});
