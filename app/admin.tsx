import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  RefreshControl,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../constants/ThemeContext';
import { apiFetch, apiLogout, getUser } from '../utils/api';

interface UserRow {
  user_id: string;
  nama: string;
  email: string;
  nim?: string;
  role: string;
  created_at: string;
}

interface AccountsResponse {
  users: UserRow[];
  total: number;
}

const ROLE_COLORS: Record<string, string> = {
  admin: '#6366f1',
  pemangku_jabatan: '#8b5cf6',
  konselor: '#0ea5e9',
  mahasiswa: '#10b981',
};

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [adminName, setAdminName] = useState('Admin');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getUser<{ nama: string }>().then((u) => { if (u?.nama) setAdminName(u.nama); });
    fetchUsers();
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const fetchUsers = async () => {
    try {
      setError(null);
      const data = await apiFetch<AccountsResponse>('/accounts');
      setUsers(data.users);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); fetchUsers(); };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Keluar dari sesi admin?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => { await apiLogout(); router.replace('/'); },
      },
    ]);
  };

  // Stats
  const totalUsers = users.length;
  const byRole = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LinearGradient
        colors={['#1e1b4b', '#312e81']}
        style={[s.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={s.headerRow}>
          <View>
            <Text style={s.headerSub}>SANCTUARY ADMIN</Text>
            <Text style={s.headerTitle}>Halo, {adminName} 👋</Text>
          </View>
          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={s.statsRow}>
          <StatCard label="Total Users" value={totalUsers} icon="people-outline" color="#818cf8" />
          <StatCard label="Mahasiswa" value={byRole['mahasiswa'] || 0} icon="school-outline" color="#34d399" />
          <StatCard label="Konselor" value={byRole['konselor'] || 0} icon="heart-outline" color="#38bdf8" />
          <StatCard label="Admin" value={(byRole['admin'] || 0) + (byRole['pemangku_jabatan'] || 0)} icon="shield-outline" color="#a78bfa" />
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={[s.sectionTitle, { color: colors.onSurface }]}>
            Daftar Pengguna
            <Text style={{ color: colors.outline }}> ({totalUsers})</Text>
          </Text>

          {loading && (
            <View style={s.centered}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={[s.loadingTxt, { color: colors.outline }]}>Memuat data...</Text>
            </View>
          )}

          {error && (
            <View style={[s.errorBox, { backgroundColor: colors.errorContainer }]}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
              <Text style={[s.errorTxt, { color: colors.error }]}>{error}</Text>
            </View>
          )}

          {!loading && !error && users.map((u) => (
            <UserCard key={u.user_id} user={u} colors={colors} />
          ))}

          {!loading && !error && users.length === 0 && (
            <View style={s.centered}>
              <Ionicons name="people-outline" size={48} color={colors.outline + '60'} />
              <Text style={[s.emptyTxt, { color: colors.outline }]}>Belum ada pengguna terdaftar</Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <View style={[s.statCard, { borderColor: color + '30', backgroundColor: color + '15' }]}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[s.statValue, { color: '#fff' }]}>{value}</Text>
      <Text style={[s.statLabel, { color: '#c7d2fe' }]}>{label}</Text>
    </View>
  );
}

function UserCard({ user, colors }: { user: UserRow; colors: any }) {
  const roleColor = ROLE_COLORS[user.role] || '#6b7280';
  const initials = (user.nama || user.email).slice(0, 2).toUpperCase();
  const date = new Date(user.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <View style={[s.userCard, { backgroundColor: colors.surfaceContainerLowest }]}>
      <View style={[s.avatar, { backgroundColor: roleColor + '20' }]}>
        <Text style={[s.avatarTxt, { color: roleColor }]}>{initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.userName, { color: colors.onSurface }]} numberOfLines={1}>{user.nama || '—'}</Text>
        <Text style={[s.userEmail, { color: colors.onSurfaceVariant }]} numberOfLines={1}>{user.email}</Text>
        {user.nim && <Text style={[s.userNim, { color: colors.outline }]}>NIM: {user.nim}</Text>}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <View style={[s.roleBadge, { backgroundColor: roleColor + '20' }]}>
          <Text style={[s.roleTxt, { color: roleColor }]}>{user.role}</Text>
        </View>
        <Text style={[s.dateJoined, { color: colors.outline }]}>{date}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  headerSub: { fontSize: 10, color: '#c7d2fe', letterSpacing: 2, fontFamily: 'PlusJakartaSans_700Bold' },
  headerTitle: { fontSize: 22, color: '#fff', fontFamily: 'PlusJakartaSans_800ExtraBold', marginTop: 2 },
  logoutBtn: { padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)' },

  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1, borderRadius: 14, padding: 10,
    alignItems: 'center', gap: 4, borderWidth: 1,
  },
  statValue: { fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  statLabel: { fontSize: 9, fontFamily: 'PlusJakartaSans_600SemiBold', textAlign: 'center', letterSpacing: 0.5 },

  content: { padding: 16, gap: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 6 },

  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  avatar: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  userName: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },
  userEmail: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 1 },
  userNim: { fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', marginTop: 2 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  roleTxt: { fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', textTransform: 'capitalize' },
  dateJoined: { fontSize: 10, fontFamily: 'PlusJakartaSans_400Regular' },

  centered: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingTxt: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium' },
  emptyTxt: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 12 },
  errorTxt: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', flex: 1 },
});
