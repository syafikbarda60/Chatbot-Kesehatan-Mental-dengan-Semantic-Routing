import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prototype/ui-shared';
import { Input, Button, useToast } from '../components/ui';
import { AuthStage } from '../components/AuthStage';
import { useAuth } from '@prototype/ui-shared';

const SLAB = '-12px -12px 26px rgba(255,255,255,0.95), 12px 12px 28px rgba(122,134,168,0.5)';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const toast = useToast();
  const { login, logout, isLoading, error, isLoggedIn, user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isLoggedIn && user && !isLoading) {
      if (user.role === 'mahasiswa') {
        router.replace('/home');
      } else {
        // Force logout if non-mahasiswa somehow got in
        logout();
      }
    }
  }, [isLoggedIn, user, isLoading, logout]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    try {
      const data = await login({ email: email.trim(), password });
      const role = data.user.role;

      if (role !== 'mahasiswa') {
        await logout(); // Clear token immediately
        toast.show('Aplikasi ini khusus mahasiswa. Konselor dan admin masuk lewat dashboard.', 'error');
        return;
      }

      toast.show(`Selamat datang kembali${data.user.name ? ', ' + data.user.name.split(' ')[0] : ''}!`);
      router.replace('/home');
    } catch {
      // error sudah disimpan di hook
    }
  };

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero: the character is the brand moment */}
        <AuthStage expression="menyapa" say="Hai! Senang kamu kembali." />

        <View style={s.heading}>
          <View style={s.brandRow}>
            <Image source={require('../assets/image.png')} style={s.logo} resizeMode="contain" />
            <Text style={[s.brandName, { color: colors.primary }]}>Sajiwa</Text>
          </View>
          <Text style={[s.heroTitle, { color: colors.onSurface }]} accessibilityRole="header">
            Masuk ke ruang tenangmu
          </Text>
        </View>

        {/* Form on a raised slab */}
        <View style={[s.card, { backgroundColor: colors.background, boxShadow: SLAB }]}>

          <Input
            label="Email"
            placeholder="nama@students.undip.ac.id"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            value={email}
            onChangeText={setEmail}
            editable={!isLoading}
            leftIcon={<Ionicons name="mail-outline" size={18} color={colors.onSurfaceVariant} />}
          />

          <Input
            label="Kata sandi"
            placeholder="Minimal 8 karakter"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={handleLogin}
            value={password}
            onChangeText={setPassword}
            editable={!isLoading}
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

          <TouchableOpacity
            onPress={() => router.push('/forgot-password')}
            style={s.forgotBtn}
            accessibilityRole="link"
          >
            <Text style={[s.forgotText, { color: colors.primary }]}>Lupa kata sandi?</Text>
          </TouchableOpacity>

          {error ? (
            <Text style={[s.errorTxt, { color: colors.error }]} accessibilityLiveRegion="polite">{error}</Text>
          ) : null}

          <Button
            label="Masuk"
            onPress={handleLogin}
            loading={isLoading}
            disabled={!email.trim() || !password.trim()}
          />
        </View>

        {/* Sign-up: a real raised button, not a tiny link */}
        <View style={s.footer}>
          <Text style={[s.footerTxt, { color: colors.onSurfaceVariant }]}>Belum punya akun?</Text>
          <Button label="Buat akun baru" variant="secondary" onPress={() => router.push('/register')} style={{ alignSelf: 'stretch' }} />
        </View>

        <View style={s.securityRow}>
          <Ionicons name="lock-closed" size={13} color={colors.textMuted} />
          <Text style={[s.securityNote, { color: colors.textMuted }]}>Percakapanmu dienkripsi dan bersifat pribadi</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },

  // Hero
  heading: { alignItems: 'center', gap: 6, marginTop: 18, marginBottom: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 36, height: 36 },
  brandName: { fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: 0.2 },
  heroTitle: { fontSize: 27, lineHeight: 34, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.8, textAlign: 'center' },

  // Form
  card: { width: '100%', maxWidth: 440, gap: 8, marginBottom: 28, padding: 20, paddingTop: 22, borderRadius: 32 },
  forgotBtn: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' },
  forgotText: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },

  footer: { width: '100%', maxWidth: 440, alignItems: 'center', gap: 10, marginBottom: 20 },
  footerTxt: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular' },

  securityRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  securityNote: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium' },
  errorTxt: {
    fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium',
    textAlign: 'center', marginBottom: 8,
  },
});
