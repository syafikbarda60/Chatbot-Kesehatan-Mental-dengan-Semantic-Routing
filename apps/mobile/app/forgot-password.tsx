import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prototype/ui-shared';
import { apiRequestPasswordReset, apiConfirmPasswordReset } from '@prototype/api-client';

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRequestOTP = async () => {
    if (!email.trim()) {
      setError('Email tidak boleh kosong');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await apiRequestPasswordReset(email.trim());
      setStep('confirm');
      Alert.alert('Sukses', 'Jika email terdaftar, OTP telah dikirimkan ke email Anda.');
    } catch (err: any) {
      setError(err.message || 'Gagal mengirim OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmReset = async () => {
    if (!otp.trim() || !newPassword.trim()) {
      setError('OTP dan Password baru harus diisi');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await apiConfirmPasswordReset(email.trim(), otp.trim(), newPassword);
      Alert.alert('Sukses', 'Password berhasil diubah. Silakan login dengan password baru.');
      router.replace('/');
    } catch (err: any) {
      setError(err.message || 'OTP salah atau gagal mengubah password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[s.blobTL, { backgroundColor: colors.primaryContainer + '50' }]} />
      <View style={[s.blobBR, { backgroundColor: colors.tertiaryContainer + '35' }]} />

      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
      </View>

      <View style={[s.content, { paddingBottom: insets.bottom + 40 }]}>
        <View style={[s.card, { backgroundColor: colors.surfaceContainerLowest }]}>
          <Text style={[s.cardTitle, { color: colors.onSurface }]}>Reset Password</Text>
          <Text style={[s.cardSub, { color: colors.onSurfaceVariant }]}>
            {step === 'request'
              ? 'Masukkan email Anda untuk menerima kode OTP pemulihan akun.'
              : 'Masukkan kode OTP yang dikirim ke email dan password baru Anda.'}
          </Text>

          {step === 'request' && (
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
          )}

          {step === 'confirm' && (
            <>
              <View style={s.field}>
                <Text style={[s.fieldLabel, { color: colors.outline }]}>KODE OTP</Text>
                <View style={[s.inputWrap, { backgroundColor: colors.surfaceContainerLow }]}>
                  <Ionicons name="keypad-outline" size={17} color={colors.outline} style={s.inputIcon} />
                  <TextInput
                    style={[s.input, { color: colors.onSurface }]}
                    placeholder="Masukkan 6 digit OTP"
                    placeholderTextColor={colors.outline + '70'}
                    keyboardType="number-pad"
                    value={otp}
                    onChangeText={setOtp}
                    editable={!isLoading}
                  />
                </View>
              </View>

              <View style={s.field}>
                <Text style={[s.fieldLabel, { color: colors.outline }]}>PASSWORD BARU</Text>
                <View style={[s.inputWrap, { backgroundColor: colors.surfaceContainerLow }]}>
                  <Ionicons name="lock-closed-outline" size={17} color={colors.outline} style={s.inputIcon} />
                  <TextInput
                    style={[s.input, { color: colors.onSurface }]}
                    placeholder="••••••••"
                    placeholderTextColor={colors.outline + '70'}
                    secureTextEntry
                    value={newPassword}
                    onChangeText={setNewPassword}
                    editable={!isLoading}
                  />
                </View>
              </View>
            </>
          )}

          {error ? (
            <Text style={[s.errorTxt, { color: colors.error }]}>{error}</Text>
          ) : null}

          <TouchableOpacity
            activeOpacity={0.88}
            style={[s.primaryWrap, isLoading && { opacity: 0.7 }]}
            onPress={step === 'request' ? handleRequestOTP : handleConfirmReset}
            disabled={isLoading}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryDim]}
              style={s.primaryBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={[s.primaryBtnTxt, { color: colors.onPrimary }]}>
                  {step === 'request' ? 'Kirim OTP' : 'Update Password'}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {step === 'confirm' && (
            <TouchableOpacity onPress={() => setStep('request')} style={{ marginTop: 16 }}>
              <Text style={{ textAlign: 'center', color: colors.primary, fontSize: 13 }}>Kirim ulang OTP</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, zIndex: 10 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },

  blobTL: {
    position: 'absolute', width: 300, height: 300, borderRadius: 150,
    top: -80, left: -80,
  },
  blobBR: {
    position: 'absolute', width: 240, height: 240, borderRadius: 120,
    bottom: -60, right: -60,
  },

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
  fieldLabel: {
    fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 15, fontFamily: 'PlusJakartaSans_500Medium' },

  primaryWrap: { borderRadius: 20, overflow: 'hidden', marginTop: 8 },
  primaryBtn: { paddingVertical: 18, alignItems: 'center', borderRadius: 20 },
  primaryBtnTxt: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', letterSpacing: 0.3 },

  errorTxt: {
    fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium',
    textAlign: 'center', marginBottom: 8, marginTop: -4,
  },
});
