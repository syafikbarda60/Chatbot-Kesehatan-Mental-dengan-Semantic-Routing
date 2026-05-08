import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../constants/ThemeContext';
import { Spacing, BorderRadius } from '../constants/theme';
import { apiSaveJournal } from '@prototype/api-client';

const MOODS = [
  { id: 'Calm', label: 'Calm', icon: 'water-outline' },
  { id: 'Anxious', label: 'Anxious', icon: 'pulse-outline' },
  { id: 'Focused', label: 'Focused', icon: 'locate-outline' },
  { id: 'Tired', label: 'Tired', icon: 'moon-outline' },
];

export default function JournalScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [content, setContent] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const formatDate = () =>
    new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert('Empty Note', 'Please write something before saving.');
      return;
    }

    setIsLoading(true);
    try {
      await apiSaveJournal({
        content: content.trim(),
        mood: mood as any,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save journal');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <View style={s.headerInner}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
            <Ionicons name="menu-outline" size={24} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.onSurface }]}>Sanctuary</Text>
          <View style={s.avatar}>
            <Ionicons name="person" size={18} color={colors.onSurfaceVariant} />
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={[s.date, { color: colors.outline }]}>{formatDate()}</Text>
        <Text style={[s.title, { color: colors.onSurface }]}>Writing Space</Text>

        <Text style={[s.label, { color: colors.onSurfaceVariant }]}>I am feeling...</Text>
        <View style={s.moodRow}>
          {MOODS.map((m) => {
            const active = mood === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[
                  s.moodChip,
                  { backgroundColor: colors.surfaceContainerLow },
                  active && { backgroundColor: colors.primaryContainer, borderColor: colors.primary, borderWidth: 1 }
                ]}
                onPress={() => setMood(m.id)}
              >
                <Ionicons name={m.icon as any} size={16} color={active ? colors.primary : colors.onSurfaceVariant} />
                <Text style={[s.moodText, { color: active ? colors.primary : colors.onSurfaceVariant }]}>{m.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TextInput
          style={[s.input, { color: colors.onSurface }]}
          placeholder="How are you really feeling?"
          placeholderTextColor={colors.outline + '70'}
          multiline
          value={content}
          onChangeText={setContent}
          textAlignVertical="top"
        />
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[s.footer, { paddingBottom: insets.bottom + 16 }]}
      >
        <View style={s.footerInner}>
          <TouchableOpacity style={s.footerIconBtn}>
            <Ionicons name="text-outline" size={20} color={colors.outline} />
          </TouchableOpacity>
          <TouchableOpacity style={s.footerIconBtn}>
            <Ionicons name="image-outline" size={20} color={colors.outline} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => router.back()} style={s.discardBtn}>
            <Text style={[s.discardText, { color: colors.onSurfaceVariant }]}>Discard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.doneBtn, { backgroundColor: '#496175' }]}
            onPress={handleSave}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.doneText}>Done</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.5 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },

  scroll: { paddingHorizontal: 24, paddingTop: 24 },
  date: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', letterSpacing: 0.5, marginBottom: 8 },
  title: { fontSize: 36, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -1, marginBottom: 32 },

  label: { fontSize: 16, fontFamily: 'PlusJakartaSans_500Medium', marginBottom: 16 },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 40 },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
  },
  moodText: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },

  input: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_500Medium',
    minHeight: 300,
    lineHeight: 32,
  },

  footer: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
    paddingTop: 12,
  },
  footerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 16,
  },
  footerIconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  discardBtn: { paddingHorizontal: 16, paddingVertical: 12 },
  discardText: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold' },
  doneBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    minWidth: 100,
    alignItems: 'center',
  },
  doneText: { color: '#fff', fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold' },
});


