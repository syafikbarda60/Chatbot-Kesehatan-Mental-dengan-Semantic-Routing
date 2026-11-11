import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prototype/ui-shared';
import { apiRegister } from '@prototype/api-client';
import { Button, Input, IconButton, useToast } from '../components/ui';
import { AuthStage } from '../components/AuthStage';

const SLAB = '-12px -12px 26px rgba(255,255,255,0.95), 12px 12px 28px rgba(122,134,168,0.5)';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const toast = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [nim, setNim] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Nama, email, dan kata sandi wajib diisi.');
      return;
    }
    if (password.length < 8) {
      setError('Kata sandi minimal 8 karakter.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiRegister({
        email: email.trim(),
        password,
        name: name.trim(),
        nim: nim.trim() || undefined,
        role: 'mahasiswa',
      });
      toast.show('Akun berhasil dibuat. Silakan masuk.');
      router.replace('/');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Registrasi gagal. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const remaining = 8 - password.length;

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.topBar}>
          <IconButton
            icon="arrow-back"
            label="Kembali"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        </View>

        <View style={s.column}>
          {/* Hero: same stage as login, a bit smaller since the form is longer */}
          <AuthStage expression="semangat" say="Yuk, kenalan dulu!" scale={0.5} />
          <View style={s.heading}>
            <Text style={[s.title, { color: colors.onSurface }]} accessibilityRole="header">Buat akun</Text>
            <Text style={[s.subtitle, { color: colors.onSurfaceVariant }]}>
              Teman cerita, jurnal, dan konseling kampus dalam satu tempat.
            </Text>
          </View>

          <View style={[s.card, { backgroundColor: colors.background, boxShadow: SLAB }]}>
            <Input
              label="Nama lengkap"
              placeholder="Nama lengkap kamu"
              autoComplete="name"
              textContentType="name"
              value={name}
              onChangeText={setName}
              editable={!isLoading}
              leftIcon={<Ionicons name="person-outline" size={18} color={colors.onSurfaceVariant} />}
            />
            <Input
              label="NIM (opsional)"
              placeholder="Nomor Induk Mahasiswa"
              keyboardType="number-pad"
              value={nim}
              onChangeText={setNim}
              editable={!isLoading}
              leftIcon={<Ionicons name="id-card-outline" size={18} color={colors.onSurfaceVariant} />}
            />
            <Input
              label="Email"
              placeholder="nama@students.undip.ac.id"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
              editable={!isLoading}
              leftIcon={<Ionicons name="mail-outline" size={18} color={colors.onSurfaceVariant} />}
            />
            <Input
              label="Kata sandi"
              placeholder="Minimal 8 karakter"
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              textContentType="newPassword"
              value={password}
              onChangeText={setPassword}
              editable={!isLoading}
              helperText={password.length > 0 && remaining > 0 ? remaining + ' karakter lagi' : undefined}
              leftIcon={<Ionicons name="lock-closed-outline" size={18} color={colors.onSurfaceVariant} />}
              rightIcon={
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              }
            />

            {error ? (
              <Text style={[s.errorTxt, { color: colors.error }]} accessibilityLiveRegion="polite">{error}</Text>
            ) : null}

            <Button label="Daftar" onPress={handleRegister} loading={isLoading} style={{ marginTop: 8 }} />
          </View>

          <View style={s.privacyRow}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.onSurfaceVariant} />
            <Text style={[s.privacyTxt, { color: colors.onSurfaceVariant }]}>
              Ceritamu bersifat pribadi. Isi percakapan dienkripsi sebelum disimpan.
            </Text>
          </View>

          <View style={s.footer}>
            <Text style={[s.footerTxt, { color: colors.onSurfaceVariant }]}>Sudah punya akun? </Text>
            <TouchableOpacity onPress={() => router.replace('/')} hitSlop={10} accessibilityRole="link">
              <Text style={[s.footerLink, { color: colors.primary }]}>Masuk</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 20 },
  topBar: { marginBottom: 4 },
  column: { width: '100%', maxWidth: 440, alignSelf: 'center' },

  heading: { alignItems: 'center', gap: 6, marginTop: 16, marginBottom: 24, paddingHorizontal: 8 },
  title: { fontSize: 27, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.8 },
  subtitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', lineHeight: 20, textAlign: 'center' },

  card: { gap: 8, marginBottom: 24, padding: 20, paddingTop: 22, borderRadius: 32 },
  errorTxt: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', textAlign: 'center', marginTop: 4 },

  privacyRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 24 },
  privacyTxt: { flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 19 },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  footerTxt: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular' },
  footerLink: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },
});
