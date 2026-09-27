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
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prototype/ui-shared';
import { NeuView, Input, Button, useToast } from '../components/ui';
import { Spacing } from '@prototype/ui-shared';
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

  // Entrance animations
  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;
  const anim3 = useRef(new Animated.Value(0)).current;
  const y1 = useRef(new Animated.Value(20)).current;
  const y2 = useRef(new Animated.Value(20)).current;
  const y3 = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (isLoggedIn) return; // Skip animation if redirecting

    Animated.stagger(120, [
      Animated.parallel([
        Animated.timing(anim1, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(y1, { toValue: 0, duration: 550, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(anim2, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(y2, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(anim3, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(y3, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

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
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Branding */}
        <Animated.View style={[s.brand, { opacity: anim1, transform: [{ translateY: y1 }] }]}>
          <NeuView radius={36} style={s.logoWrap}>
            <Image source={require('../assets/image.png')} style={{ width: 64, height: 64 }} resizeMode="contain" />
          </NeuView>
          <Text style={[s.brandName, { color: colors.onSurface }]} accessibilityRole="header">Sajiwa</Text>
          <Text style={[s.brandTagline, { color: colors.onSurfaceVariant }]}>
            Ruang tenang untuk pikiranmu.
          </Text>
        </Animated.View>

        {/* Form Card */}
        <Animated.View style={[s.cardWrap, { opacity: anim2, transform: [{ translateY: y2 }] }]}>
          <View style={s.card}>
            <Text style={[s.cardTitle, { color: colors.onSurface }]}>Selamat datang kembali</Text>
            <Text style={[s.cardSub, { color: colors.onSurfaceVariant }]}>
              Masuk untuk melanjutkan perjalananmu.
            </Text>

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
        </Animated.View>

        {/* Footer */}
        <Animated.View style={[s.footer, { opacity: anim3, transform: [{ translateY: y3 }] }]}>
          <Text style={[s.footerTxt, { color: colors.onSurfaceVariant }]}>Belum punya akun? </Text>
          <TouchableOpacity onPress={() => router.push('/register')} hitSlop={10} accessibilityRole="link">
            <Text style={[s.footerLink, { color: colors.primary }]}>Daftar sekarang</Text>
          </TouchableOpacity>
        </Animated.View>

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
  scroll: { flexGrow: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },

  // Branding
  brand: { alignItems: 'center', marginBottom: 32 },
  logoWrap: {
    width: 104, height: 104,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  brandName: {
    fontSize: 30, fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: -0.8, marginBottom: 4,
  },
  brandTagline: {
    fontSize: 15, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center',
  },

  // Form card
  cardWrap: { width: '100%', maxWidth: 440, marginBottom: 28 },
  card: { gap: 8 },
  cardTitle: {
    fontSize: 22, fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: -0.5,
  },
  cardSub: {
    fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 21, marginBottom: 12,
  },
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
