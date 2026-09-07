import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prototype/ui-shared';
import { Spacing } from '@prototype/ui-shared';
import { useAuth } from '@prototype/ui-shared';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
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
        alert('Akses Ditolak: Aplikasi mobile hanya untuk Mahasiswa.');
        return;
      }
      
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
      {/* Decorative blobs */}
      <View style={[s.blobTL, { backgroundColor: colors.primaryContainer + '50' }]} />
      <View style={[s.blobBR, { backgroundColor: colors.tertiaryContainer + '35' }]} />

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Branding */}
        <Animated.View style={[s.brand, { opacity: anim1, transform: [{ translateY: y1 }] }]}>
          <View style={s.logoWrap}>
            <Image
              source={require('../assets/image.png')}
              style={{
                width: 120, // Anda bisa perbesar ukurannya jika mau, karena tidak ada background lagi
                height: 120,
                tintColor: colors.primary
              }}
              resizeMode="contain"
            />
          </View>
          <Text style={[s.brandName, { color: colors.onSurface }]}>Digital Sanctuary</Text>
          <Text style={[s.brandTagline, { color: colors.onSurfaceVariant }]}>
            Return to your inner quiet.
          </Text>
        </Animated.View>

        {/* Form Card */}
        <Animated.View
          style={[s.card, { backgroundColor: colors.surfaceContainerLowest, opacity: anim2, transform: [{ translateY: y2 }] }]}
        >
          <Text style={[s.cardTitle, { color: colors.onSurface }]}>Welcome back.</Text>
          <Text style={[s.cardSub, { color: colors.onSurfaceVariant }]}>
            Sign in to continue your journey.
          </Text>

          {/* Email field */}
          <View style={s.field}>
            <Text style={[s.fieldLabel, { color: colors.outline }]}>EMAIL ADDRESS</Text>
            <View style={[s.inputWrap, { backgroundColor: colors.surfaceContainerLow }]}>
              <Ionicons name="mail-outline" size={17} color={colors.outline} style={s.inputIcon} />
              <TextInput
                style={[s.input, { color: colors.onSurface }]}
                placeholder="your.name@university.ac.id"
                placeholderTextColor={colors.outline + '70'}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                editable={!isLoading}
              />
            </View>
          </View>

          {/* Password field */}
          <View style={s.field}>
            <View style={s.labelRow}>
              <Text style={[s.fieldLabel, { color: colors.outline }]}>PASSWORD</Text>
              <TouchableOpacity onPress={() => router.push('/forgot-password')}>
                <Text style={[s.forgotText, { color: colors.primary }]}>Forgot?</Text>
              </TouchableOpacity>
            </View>
            <View style={[s.inputWrap, { backgroundColor: colors.surfaceContainerLow }]}>
              <Ionicons name="lock-closed-outline" size={17} color={colors.outline} style={s.inputIcon} />
              <TextInput
                style={[s.input, { color: colors.onSurface }]}
                placeholder="••••••••"
                placeholderTextColor={colors.outline + '70'}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                editable={!isLoading}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ paddingLeft: 8 }}>
                <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color={colors.outline} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Error message */}
          {error ? (
            <Text style={[s.errorTxt, { color: colors.error }]}>{error}</Text>
          ) : null}

          {/* Sign In button */}
          <TouchableOpacity
            activeOpacity={0.88}
            style={[s.primaryWrap, isLoading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryDim]}
              style={s.primaryBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {isLoading
                ? <ActivityIndicator color={colors.onPrimary} />
                : <Text style={[s.primaryBtnTxt, { color: colors.onPrimary }]}>Sign In</Text>
              }
            </LinearGradient>
          </TouchableOpacity>

          {/* Divider */}
          <View style={s.divider}>
            <View style={[s.divLine, { backgroundColor: colors.outlineVariant + '50' }]} />
            <Text style={[s.divText, { color: colors.outline }]}>OR CONTINUE WITH</Text>
            <View style={[s.divLine, { backgroundColor: colors.outlineVariant + '50' }]} />
          </View>

          {/* Social buttons */}
          <View style={s.socialRow}>
            <TouchableOpacity style={[s.socialBtn, { backgroundColor: colors.surfaceContainerLow }]} activeOpacity={0.8}>
              <Ionicons name="logo-google" size={20} color="#4285F4" />
              <Text style={[s.socialTxt, { color: colors.onSurface }]}>Google</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.socialBtn, { backgroundColor: colors.surfaceContainerLow }]} activeOpacity={0.8}>
              <Ionicons name="logo-apple" size={20} color={colors.onSurface} />
              <Text style={[s.socialTxt, { color: colors.onSurface }]}>Apple</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Footer */}
        <Animated.View style={[s.footer, { opacity: anim3, transform: [{ translateY: y3 }] }]}>
          <Text style={[s.footerTxt, { color: colors.onSurfaceVariant }]}>New to Sanctuary?  </Text>
          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={[s.footerLink, { color: colors.primary }]}>Create an account</Text>
          </TouchableOpacity>
        </Animated.View>

        <Text style={[s.securityNote, { color: colors.outline + '60' }]}>
          YOUR DATA IS ENCRYPTED AND SECURE
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, alignItems: 'center' },

  blobTL: {
    position: 'absolute', width: 300, height: 300, borderRadius: 150,
    top: -80, left: -80,
  },
  blobBR: {
    position: 'absolute', width: 240, height: 240, borderRadius: 120,
    bottom: -60, right: -60,
  },

  // Branding
  brand: { alignItems: 'center', marginBottom: 40, marginTop: 16 },
  logoWrap: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  brandName: {
    fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: -0.6, marginBottom: 6,
  },
  brandTagline: {
    fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center',
  },

  // Form card
  card: {
    width: '100%', borderRadius: 28, padding: 28,
    shadowColor: '#2b3437',
    shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.08, shadowRadius: 48,
    elevation: 5, marginBottom: 24,
  },
  cardTitle: {
    fontSize: 28, fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: -0.6, marginBottom: 4,
  },
  cardSub: {
    fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 28,
  },

  field: { marginBottom: 16 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel: {
    fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
  },
  forgotText: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 15, fontFamily: 'PlusJakartaSans_500Medium' },

  primaryWrap: { borderRadius: 20, overflow: 'hidden', marginTop: 8 },
  primaryBtn: { paddingVertical: 18, alignItems: 'center', borderRadius: 20 },
  primaryBtnTxt: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', letterSpacing: 0.3 },

  divider: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: 24, gap: 12,
  },
  divLine: { flex: 1, height: 1 },
  divText: {
    fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 1.5, textTransform: 'uppercase',
  },

  socialRow: { flexDirection: 'row', gap: 12 },
  socialBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 16,
  },
  socialTxt: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },

  footer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  footerTxt: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular' },
  footerLink: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },

  securityNote: {
    fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium',
    letterSpacing: 1.2, textAlign: 'center', marginBottom: 16,
  },
  errorTxt: {
    fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium',
    textAlign: 'center', marginBottom: 8, marginTop: -4,
  },
});


