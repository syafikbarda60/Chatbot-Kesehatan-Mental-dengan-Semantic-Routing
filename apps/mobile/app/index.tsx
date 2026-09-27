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
import { NeuView, Input, Button, useToast } from '../components/ui';
import { Companion } from '../components/chat';
import { useAuth } from '@prototype/ui-shared';

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

      toast.show(`Selamat datang kembali${data.user.nama ? ', ' + data.user.nama.split(' ')[0] : ''}!`);
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
        {/* Hero: the companion greets you */}
        <NeuView radius={30} style={s.hero}>
          <View style={{ flex: 1, gap: 8 }}>
            <View style={s.brandRow}>
              <Image source={require('../assets/image.png')} style={s.logo} resizeMode="contain" />
              <Text style={[s.brandName, { color: colors.primary }]}>Sajiwa</Text>
            </View>
            <Text style={[s.heroTitle, { color: colors.onSurface }]} accessibilityRole="header">
              Hai, senang kamu kembali.
            </Text>
            <Text style={[s.heroSub, { color: colors.onSurfaceVariant }]}>Ruang tenang untuk pikiranmu.</Text>
          </View>
          <Companion expression="menyapa" size={132} />
        </NeuView>

        {/* Form */}
        <View style={s.card}>
          <Text style={[s.cardTitle, { color: colors.onSurface }]}>Masuk ke akunmu</Text>

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

        {/* Footer */}
        <View style={s.footer}>
          <Text style={[s.footerTxt, { color: colors.onSurfaceVariant }]}>Belum punya akun? </Text>
          <TouchableOpacity onPress={() => router.push('/register')} hitSlop={10} accessibilityRole="link">
            <Text style={[s.footerLink, { color: colors.primary }]}>Daftar sekarang</Text>
          </TouchableOpacity>
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
  hero: {
    width: '100%', maxWidth: 440, flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingLeft: 20, paddingRight: 8, paddingVertical: 16, marginBottom: 28,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 26, height: 26 },
  brandName: { fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.2 },
  heroTitle: { fontSize: 24, lineHeight: 30, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.6 },
  heroSub: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', lineHeight: 20 },

  // Form
  card: { width: '100%', maxWidth: 440, gap: 8, marginBottom: 28 },
  cardTitle: { fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.3, marginBottom: 8 },
  forgotBtn: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' },
  forgotText: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },

  footer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  footerTxt: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular' },
  footerLink: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },

  securityRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  securityNote: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium' },
  errorTxt: {
    fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium',
    textAlign: 'center', marginBottom: 8,
  },
});
