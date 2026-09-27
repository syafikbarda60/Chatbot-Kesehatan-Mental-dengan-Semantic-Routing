import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prototype/ui-shared';
import { apiRegister } from '@prototype/api-client';
import { Button, NeuView, Input, IconButton, useToast } from '../components/ui';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const toast = useToast();

  const anim = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(20)).current;

  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [nim, setNim] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(anim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleRegister = async () => {
    if (!nama.trim() || !email.trim() || !password.trim()) {
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
        nama: nama.trim(),
        nim: nim.trim() || undefined,
        role: 'mahasiswa',
      });
      toast.show('Akun berhasil dibuat. Silakan masuk dengan email dan kata sandimu.');
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

        <Animated.View style={[s.column, { opacity: anim, transform: [{ translateY: y }] }]}>
          <Text style={[s.title, { color: colors.onSurface }]} accessibilityRole="header">Buat akun</Text>
          <Text style={[s.subtitle, { color: colors.onSurfaceVariant }]}>
            Mulai perjalanan menjaga kesehatan mentalmu hari ini.
          </Text>

          <View style={s.card}>
            <Input
              label="Nama lengkap"
              placeholder="Nama lengkap kamu"
              autoComplete="name"
              textContentType="name"
              value={nama}
              onChangeText={setNama}
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
        </Animated.View>
      </ScrollView>

    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  topBar: { marginBottom: 24 },
  column: { width: '100%', maxWidth: 440, alignSelf: 'center' },

  title: { fontSize: 30, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.8, marginBottom: 6 },
  subtitle: { fontSize: 15, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 22, marginBottom: 24 },

  card: { gap: 8, marginBottom: 24 },
  errorTxt: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', textAlign: 'center', marginTop: 4 },

  privacyRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 24 },
  privacyTxt: { flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 19 },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  footerTxt: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular' },
  footerLink: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },
});
