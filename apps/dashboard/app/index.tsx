import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  Pressable, ActivityIndicator, Animated, useRef,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { apiLogin } from '@prototype/api-client';

const C = {
  bg: '#f1f4f9',
  card: '#ffffff',
  primary: '#356385',
  primaryLight: '#a4d1f8',
  text: '#2d3339',
  muted: '#596067',
  border: '#eaeef4',
  error: '#a83836',
};

export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiLogin(email.trim(), password);
      const role = data.user.role;
      if (role === 'admin' || role === 'pemangku_jabatan' || role === 'konselor') {
        router.replace('/(dashboard)');
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
      {/* Left decorative panel */}
      <View style={s.heroPanel}>
        <View style={s.heroBadge}>
          <MaterialIcons name="shield" size={32} color="#fff" />
        </View>
        <Text style={s.heroTitle}>Sanctuary{'\n'}Admin Portal</Text>
        <Text style={s.heroSub}>Mental health monitoring platform for campus operators and counselors.</Text>

        <View style={s.featureList}>
          {['Real-time student monitoring', 'Assessment analytics', 'Consultation management', 'Guardrail alert system'].map((f) => (
            <View key={f} style={s.featureRow}>
              <MaterialIcons name="check-circle" size={16} color="rgba(255,255,255,0.7)" />
              <Text style={s.featureTxt}>{f}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Right: login form */}
      <View style={s.formPanel}>
        <View style={s.formCard}>
          <Text style={s.formTitle}>Welcome back</Text>
          <Text style={s.formSub}>Sign in to access your dashboard</Text>

          {/* Email */}
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>EMAIL ADDRESS</Text>
            <View style={s.inputWrap}>
              <MaterialIcons name="mail-outline" size={18} color={C.muted} style={{ marginRight: 10 }} />
              <TextInput
                style={s.input}
                placeholder="admin@example.com"
                placeholderTextColor={C.muted + '80'}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                editable={!loading}
              />
            </View>
          </View>

          {/* Password */}
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>PASSWORD</Text>
            <View style={s.inputWrap}>
              <MaterialIcons name="lock-outline" size={18} color={C.muted} style={{ marginRight: 10 }} />
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="••••••••"
                placeholderTextColor={C.muted + '80'}
                secureTextEntry={!showPass}
                value={password}
                onChangeText={setPassword}
                editable={!loading}
              />
              <Pressable onPress={() => setShowPass(!showPass)}>
                <MaterialIcons name={showPass ? 'visibility-off' : 'visibility'} size={18} color={C.muted} />
              </Pressable>
            </View>
          </View>

          {/* Error */}
          {error && (
            <View style={s.errorBox}>
              <MaterialIcons name="error-outline" size={16} color={C.error} />
              <Text style={s.errorTxt}>{error}</Text>
            </View>
          )}

          {/* Submit */}
          <Pressable
            style={(state: any) => [s.btn, state.hovered && { opacity: 0.9 }, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnTxt}>Sign In to Dashboard</Text>
            }
          </Pressable>

          <Text style={s.hint}>Access restricted to Admin, Konselor & Operator roles.</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: C.bg },

  heroPanel: {
    width: 400, backgroundColor: C.primary,
    padding: 48, justifyContent: 'center',
  },
  heroBadge: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  heroTitle: {
    fontSize: 36, fontWeight: '800', color: '#fff',
    letterSpacing: -1, marginBottom: 12, lineHeight: 44,
  },
  heroSub: { fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 22, marginBottom: 40 },
  featureList: { gap: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureTxt: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },

  formPanel: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 48 },
  formCard: {
    width: '100%', maxWidth: 420,
    backgroundColor: C.card, borderRadius: 16,
    padding: 40,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06, shadowRadius: 32, elevation: 4,
  },
  formTitle: { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5, marginBottom: 6 },
  formSub: { fontSize: 14, color: C.muted, marginBottom: 32 },

  fieldGroup: { marginBottom: 20 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 1.5, marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: '#f8f9fd',
  },
  input: { flex: 1, fontSize: 15, color: C.text, outlineStyle: 'none' as any },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff5f5', borderRadius: 8,
    padding: 12, marginBottom: 16,
  },
  errorTxt: { fontSize: 13, color: C.error, flex: 1 },

  btn: {
    backgroundColor: C.primary, borderRadius: 10,
    paddingVertical: 15, alignItems: 'center',
    marginTop: 4, transition: 'all 0.2s' as any,
  },
  btnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  hint: { fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 20 },
});


