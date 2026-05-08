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
  Alert,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prototype/ui-shared';
import { apiRegister, saveToken, saveUser } from '@prototype/api-client';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const anim = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(20)).current;

  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [nim, setNim] = useState('');
  const [password, setPassword] = useState('');
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
      setError('Nama, email, dan password wajib diisi');
      return;
    }
    if (password.length < 8) {
      setError('Password minimal 8 karakter');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res: any = await apiRegister({
        email: email.trim(),
        password,
        nama: nama.trim(),
        nim: nim.trim() || undefined,
        role: 'mahasiswa',
      });

      if (res.session) {
        // Auto login jika session langsung ada (email confirmation off)
        await saveToken(res.session.access_token);
        await saveUser({
          user_id: res.user_id,
          email: email.trim(),
          nama: nama.trim(),
          nim: nim.trim() || undefined,
          role: 'mahasiswa',
        });
        router.replace('/home');
      } else {
        // Butuh login manual atau cek email
        Alert.alert('Registrasi Berhasil', 'Silakan login dengan akun baru kamu.');
        router.replace('/');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Registrasi gagal. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Blobs */}
      <View style={[s.blobBL, { backgroundColor: colors.primaryContainer + '40' }]} />
      <View style={[s.blobTR, { backgroundColor: colors.tertiaryContainer + '30' }]} />

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top bar */}
        <View style={s.topBar}>
          <TouchableOpacity
            style={[s.backBtn, { backgroundColor: colors.surfaceContainerLow }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={18} color={colors.onSurface} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/')}>
            <Text style={[s.signinLink, { color: colors.onSurfaceVariant }]}>Sign in</Text>
          </TouchableOpacity>
        </View>

        {/* Header */}
        <Animated.View style={[s.header, { opacity: anim, transform: [{ translateY: y }] }]}>
          <Image
            source={require('../assets/image.png')}
            style={{ width: 150, height: 150, alignSelf: 'center' }}
            resizeMode="contain"
          />
          <Text style={[s.title, { color: colors.onSurface }]}>Create your account.</Text>
          <Text style={[s.subtitle, { color: colors.onSurfaceVariant }]}>
            Start your mindful journey today.
          </Text>
        </Animated.View>

        {/* Form card */}
        <Animated.View
          style={[s.card, { backgroundColor: colors.surfaceContainerLowest, opacity: anim, transform: [{ translateY: y }] }]}
        >
          {/* Full Name */}
          <View style={s.field}>
            <Text style={[s.fieldLabel, { color: colors.outline }]}>NAMA LENGKAP</Text>
            <View style={[s.inputWrap, { backgroundColor: colors.surfaceContainerLow }]}>
              <Ionicons name="person-outline" size={17} color={colors.outline} style={s.icon} />
              <TextInput
                style={[s.input, { color: colors.onSurface }]}
                placeholder="Nama lengkap kamu"
                placeholderTextColor={colors.outline + '70'}
                value={nama}
                onChangeText={setNama}
                editable={!isLoading}
              />
            </View>
          </View>

          {/* NIM */}
          <View style={s.field}>
            <Text style={[s.fieldLabel, { color: colors.outline }]}>NIM (opsional)</Text>
            <View style={[s.inputWrap, { backgroundColor: colors.surfaceContainerLow }]}>
              <Ionicons name="id-card-outline" size={17} color={colors.outline} style={s.icon} />
              <TextInput
                style={[s.input, { color: colors.onSurface }]}
                placeholder="Nomor Induk Mahasiswa"
                placeholderTextColor={colors.outline + '70'}
                keyboardType="number-pad"
                value={nim}
                onChangeText={setNim}
                editable={!isLoading}
              />
            </View>
          </View>

          {/* University Email */}
          <View style={s.field}>
            <Text style={[s.fieldLabel, { color: colors.outline }]}>EMAIL</Text>
            <View style={[s.inputWrap, { backgroundColor: colors.surfaceContainerLow }]}>
              <Ionicons name="at-outline" size={17} color={colors.outline} style={s.icon} />
              <TextInput
                style={[s.input, { color: colors.onSurface }]}
                placeholder="email@university.ac.id"
                placeholderTextColor={colors.outline + '70'}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                editable={!isLoading}
              />
            </View>
          </View>

          {/* Password */}
          <View style={s.field}>
            <Text style={[s.fieldLabel, { color: colors.outline }]}>PASSWORD</Text>
            <View style={[s.inputWrap, { backgroundColor: colors.surfaceContainerLow }]}>
              <Ionicons name="lock-open-outline" size={17} color={colors.outline} style={s.icon} />
              <TextInput
                style={[s.input, { color: colors.onSurface }]}
                placeholder="Minimum 8 karakter"
                placeholderTextColor={colors.outline + '70'}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                editable={!isLoading}
              />
            </View>
          </View>

          {/* Error */}
          {error ? (
            <Text style={[s.errorTxt, { color: colors.error }]}>{error}</Text>
          ) : null}

          {/* CTA */}
          <TouchableOpacity
            activeOpacity={0.88}
            style={[s.primaryWrap, isLoading && { opacity: 0.7 }]}
            onPress={handleRegister}
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
                : <Text style={[s.primaryBtnTxt, { color: colors.onPrimary }]}>Join Sanctuary</Text>
              }
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Bento feature cards */}
        <Animated.View style={[s.bentoRow, { opacity: anim }]}>
          <View style={[s.bentoCard, { backgroundColor: colors.surfaceContainerLow }]}>
            <Ionicons name="sparkles-outline" size={20} color={colors.primary} />
            <Text style={[s.bentoTitle, { color: colors.onSurface }]}>Daily Growth</Text>
            <Text style={[s.bentoDesc, { color: colors.onSurfaceVariant }]}>
              Personalized wellness pathways.
            </Text>
          </View>
          <View style={[s.bentoCard, { backgroundColor: colors.surfaceContainerHighest, marginTop: 28 }]}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
            <Text style={[s.bentoTitle, { color: colors.onSurface }]}>Safe Space</Text>
            <Text style={[s.bentoDesc, { color: colors.onSurfaceVariant }]}>
              End-to-end encrypted reflections.
            </Text>
          </View>
        </Animated.View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={[s.footerTxt, { color: colors.onSurfaceVariant }]}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/')}>
            <Text style={[s.footerLink, { color: colors.primary }]}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },

  blobBL: {
    position: 'absolute', width: 260, height: 260, borderRadius: 130,
    bottom: -50, left: -90,
  },
  blobTR: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    top: 50, right: -70,
  },

  topBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 32,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  signinLink: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },

  header: { marginBottom: 24 },
  title: {
    fontSize: 32, fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: -0.8, marginBottom: 6,
  },
  subtitle: {
    fontSize: 15, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 22,
  },

  card: {
    borderRadius: 28, padding: 28,
    shadowColor: '#2b3437',
    shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.08, shadowRadius: 48,
    elevation: 5, marginBottom: 24,
  },

  field: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
  },
  icon: { marginRight: 12 },
  input: { flex: 1, fontSize: 15, fontFamily: 'PlusJakartaSans_500Medium' },

  errorTxt: {
    fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium',
    textAlign: 'center', marginBottom: 12, marginTop: -4,
  },

  primaryWrap: { borderRadius: 20, overflow: 'hidden' },
  primaryBtn: { paddingVertical: 18, alignItems: 'center', borderRadius: 20 },
  primaryBtnTxt: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', letterSpacing: 0.2 },

  bentoRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  bentoCard: {
    flex: 1, borderRadius: 24, padding: 24, gap: 8,
  },
  bentoTitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },
  bentoDesc: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 18 },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  footerTxt: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular' },
  footerLink: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },
});



