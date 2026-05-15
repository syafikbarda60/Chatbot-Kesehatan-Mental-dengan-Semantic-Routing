import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  Pressable, ActivityIndicator, Animated, Image, Easing
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { apiLogin } from '@prototype/api-client';

const logoImg = require('../assets/images/logo.png');

const C = {
  background: '#f8f9fa',
  surfaceContainerLowest: '#ffffff',
  onSurface: '#2b3437',
  onSurfaceVariant: '#586064',
  primary: '#496175',
  outline: '#737c7f',
  error: '#9f403d',
  border: '#eaeff1',
};

export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 800, useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0, duration: 800,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      })
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiLogin({ email: email.trim(), password });
      const role = data.user.role;
      if (role === 'admin' || role === 'pemangku_jabatan' || role === 'konselor') {
        // Token already saved by apiLogin — force reload to let _layout pick it up
        if (typeof window !== 'undefined') {
          window.location.href = '/(dashboard)';
        } else {
          router.replace('/(dashboard)');
        }
      } else {
        setError('Akses ditolak. Hanya admin/konselor/operator yang dapat masuk.');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <View style={s.navbar}>
        <View style={s.navLeft}>
          <Image source={logoImg} style={s.navLogo} resizeMode="contain" />
          <Text style={s.navTitle}>Sanctuary</Text>
        </View>
      </View>

      <View style={s.main}>
        <Animated.View style={[s.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={s.cardHeader}>
            <Text style={s.title}>Admin Portal</Text>
            <Text style={s.subtitle}>Silakan masuk untuk mengelola sistem.</Text>
          </View>

          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>EMAIL ADDRESS</Text>
            <View style={s.inputWrap}>
              <MaterialIcons name="mail-outline" size={20} color={C.outline} style={{ marginRight: 12 }} />
              <TextInput
                style={s.input}
                placeholder="admin@sanctuary.com"
                placeholderTextColor={C.outline + '80'}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                editable={!loading}
              />
            </View>
          </View>

          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>PASSWORD</Text>
            <View style={s.inputWrap}>
              <MaterialIcons name="lock-outline" size={20} color={C.outline} style={{ marginRight: 12 }} />
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="••••••••"
                placeholderTextColor={C.outline + '80'}
                secureTextEntry={!showPass}
                value={password}
                onChangeText={setPassword}
                editable={!loading}
              />
              <Pressable onPress={() => setShowPass(!showPass)}>
                <MaterialIcons name={showPass ? 'visibility-off' : 'visibility'} size={20} color={C.outline} />
              </Pressable>
            </View>
          </View>

          {error && (
            <View style={s.errorBox}>
              <MaterialIcons name="error-outline" size={16} color={C.error} />
              <Text style={s.errorTxt}>{error}</Text>
            </View>
          )}

          <Pressable
            style={(state: any) => [
              s.btn,
              state.hovered && { backgroundColor: '#3d5569' },
              loading && { opacity: 0.7 }
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnTxt}>Sign In to Dashboard</Text>
            }
          </Pressable>

          <Text style={s.hint}>Access restricted to Admin, Konselor & Operator roles.</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  navbar: {
    height: 64,
    backgroundColor: 'rgba(248, 249, 250, 0.7)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    paddingHorizontal: 24,
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 50,
  },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navLogo: { width: 32, height: 32 },
  navTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: C.onSurface,
    letterSpacing: -0.5,
  },
  main: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: C.surfaceContainerLowest,
    borderRadius: 16,
    padding: 40,
    shadowColor: '#2b3437',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 40,
    elevation: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardHeader: { marginBottom: 32, alignItems: 'center' },
  title: {
    fontSize: 28,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: C.onSurface,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.onSurfaceVariant,
  },
  fieldGroup: { marginBottom: 24 },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.outline,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1dce0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.background,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.onSurface,
    outlineStyle: 'none' as any,
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff7f6',
    borderRadius: 8,
    padding: 12, marginBottom: 24,
    borderWidth: 1, borderColor: '#fe8983',
  },
  errorTxt: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: C.error, flex: 1 },
  btn: {
    backgroundColor: C.primary,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    transition: 'all 0.2s' as any,
  },
  btnTxt: { color: '#f3f8ff', fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold' },
  hint: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.outline,
    textAlign: 'center',
    marginTop: 24,
  },
});
