import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prototype/ui-shared';
import { apiRequestPasswordReset, apiConfirmPasswordReset } from '@prototype/api-client';
import { NeuView, Input, Button, IconButton, FadeIn, useToast } from '../components/ui';

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const toast = useToast();

  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRequestOTP = async () => {
    if (!email.trim()) {
      setError('Email tidak boleh kosong.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await apiRequestPasswordReset(email.trim());
      setStep('confirm');
      toast.show('Kode OTP dikirim. Cek email kamu.', 'info');
    } catch (err: any) {
      setError(err.message || 'Gagal mengirim kode OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmReset = async () => {
    if (!otp.trim() || !newPassword.trim()) {
      setError('Kode OTP dan kata sandi baru harus diisi.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Kata sandi minimal 8 karakter.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await apiConfirmPasswordReset(email.trim(), otp.trim(), newPassword);
      toast.show('Kata sandi berhasil diubah. Silakan masuk dengan kata sandi baru.');
      router.replace('/');
    } catch (err: any) {
      setError(err.message || 'Kode OTP salah atau gagal mengubah kata sandi.');
    } finally {
      setIsLoading(false);
    }
  };

  const isRequest = step === 'request';

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.topBar}>
          <IconButton
            icon="arrow-back"
            label="Kembali"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        </View>

        <FadeIn>
        <View style={s.content}>
          <Text style={[s.step, { color: colors.onSurfaceVariant }]}>Langkah {isRequest ? 1 : 2} dari 2</Text>
          <Text style={[s.title, { color: colors.onSurface }]} accessibilityRole="header">
            {isRequest ? 'Lupa kata sandi?' : 'Cek email kamu'}
          </Text>
          <Text style={[s.sub, { color: colors.onSurfaceVariant }]}>
            {isRequest
              ? 'Masukkan email akunmu. Kami akan mengirim kode OTP untuk mengatur ulang kata sandi.'
              : 'Jika ' + email.trim() + ' terdaftar, kode OTP sudah dikirim. Masukkan kode itu dan kata sandi barumu.'}
          </Text>

          <View style={s.card}>
            {isRequest ? (
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
            ) : (
              <>
                <Input
                  label="Kode OTP"
                  placeholder="6 digit kode"
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  value={otp}
                  onChangeText={setOtp}
                  editable={!isLoading}
                  leftIcon={<Ionicons name="keypad-outline" size={18} color={colors.onSurfaceVariant} />}
                />
                <Input
                  label="Kata sandi baru"
                  placeholder="Minimal 8 karakter"
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  editable={!isLoading}
                  leftIcon={<Ionicons name="lock-closed-outline" size={18} color={colors.onSurfaceVariant} />}
                />
              </>
            )}

            {error ? (
              <Text style={[s.errorTxt, { color: colors.error }]} accessibilityLiveRegion="polite">{error}</Text>
            ) : null}

            <Button
              label={isRequest ? 'Kirim kode OTP' : 'Simpan kata sandi baru'}
              onPress={isRequest ? handleRequestOTP : handleConfirmReset}
              loading={isLoading}
              style={{ marginTop: 8 }}
            />

            {!isRequest && (
              <TouchableOpacity onPress={() => setStep('request')} style={s.linkBtn} accessibilityRole="button">
                <Text style={[s.linkTxt, { color: colors.primary }]}>Kirim ulang kode</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        </FadeIn>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  topBar: { marginBottom: 32 },
  content: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  step: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 6 },
  title: { fontSize: 28, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.7, marginBottom: 8 },
  sub: { fontSize: 15, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 22, marginBottom: 24 },
  card: { gap: 8 },
  errorTxt: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', textAlign: 'center', marginTop: 4 },
  linkBtn: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  linkTxt: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
});
