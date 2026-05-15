import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  Animated, Pressable, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  apiGetDashboard, apiGetAccounts, clearAuthSync,
  getStoredUserSync, type DashboardData, type UserRow,
} from '@prototype/api-client';

// ── Palette ───────────────────────────────────────────────────────────────────
const Colors = {
  bgApp: '#f8f9fd',
  bgCard: '#ffffff',
  textDark: '#2d3339',
  textMuted: '#596067',
  border: '#eaeef4',
  primary: '#356385',
  primaryContainer: '#a4d1f8',
  tertiary: '#5a5c85',
  tertiaryContainer: '#cdcefe',
  error: '#a83836',
  errorContainer: '#fa746f',
  secondaryContainer: '#d4e4f6',
  onSecondaryContainer: '#445462',
};

const ROLE_COLOR: Record<string, string> = {
  admin: '#356385', pemangku_jabatan: '#5a5c85',
  konselor: '#0ea5e9', mahasiswa: '#10b981',
};

// ── Animation helpers ─────────────────────────────────────────────────────────
const InteractiveBtn = ({ children, style, onPress }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  const press   = () => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 20 }).start();
  const release = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 20 }).start();
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable onPressIn={press} onPressOut={release} onPress={onPress}>{children}</Pressable>
    </Animated.View>
  );
};

const GlacialAnim = ({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: any }) => {
  const fade  = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(fade,  { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slide, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();
  }, [delay]);
  return <Animated.View style={[{ opacity: fade, transform: [{ translateY: slide }] }, style]}>{children}</Animated.View>;
};

// ── Web-native SVG Chart with hover tooltip ──────────────────────────────────
const WebChart = ({ labels, values, width, height }: { labels: string[], values: number[], width: number, height: number }) => {
  const containerRef = useRef<any>(null);

  const pad = { top: 20, right: 20, bottom: 30, left: 40 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;
  const maxVal = Math.max(...values, 1);
  const yTicks = 4;

  const points = values.map((v, i) => ({
    x: pad.left + (i / Math.max(values.length - 1, 1)) * cw,
    y: pad.top + ch - (v / maxVal) * ch,
    v, label: labels[i] || '',
  }));

  const pathD = points.map((p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = points[i - 1];
    const cx1 = prev.x + (p.x - prev.x) * 0.4;
    const cx2 = p.x - (p.x - prev.x) * 0.4;
    return `C ${cx1} ${prev.y}, ${cx2} ${p.y}, ${p.x} ${p.y}`;
  }).join(' ');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${pad.top + ch} L ${points[0].x} ${pad.top + ch} Z`;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((maxVal / yTicks) * i));

  // Build SVG + tooltip container HTML (NO script tags, NO inline event handlers)
  const htmlContent = `
    <div style="position:relative;width:${width}px;height:${height}px;font-family:Inter,system-ui,sans-serif;" data-chart="root">
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${Colors.primary}" stop-opacity="0.15"/>
            <stop offset="100%" stop-color="${Colors.primary}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${yLabels.map((v) => {
          const y = pad.top + ch - (v / maxVal) * ch;
          return `<text x="${pad.left - 8}" y="${y + 4}" text-anchor="end" fill="${Colors.textMuted}" font-size="11">${v}</text>
                  <line x1="${pad.left}" y1="${y}" x2="${pad.left + cw}" y2="${y}" stroke="${Colors.border}" stroke-width="0.5" stroke-dasharray="4,4"/>`;
        }).join('')}
        ${points.map((p) => `<text x="${p.x}" y="${height - 6}" text-anchor="middle" fill="${Colors.textMuted}" font-size="11">${p.label}</text>`).join('')}
        <path d="${areaD}" fill="url(#areaGrad)"/>
        <path d="${pathD}" fill="none" stroke="${Colors.primary}" stroke-width="2.5" stroke-linecap="round"/>
        ${points.map((p, i) => `
          <circle cx="${p.x}" cy="${p.y}" r="5" fill="white" stroke="${Colors.primary}" stroke-width="2" data-dot="${i}"/>
          <circle cx="${p.x}" cy="${p.y}" r="20" fill="transparent" data-hit="${i}" style="cursor:pointer"/>
        `).join('')}
      </svg>
      <div data-tip="1" style="display:none;position:absolute;background:${Colors.primary};color:#fff;padding:6px 14px;border-radius:8px;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,0.18);text-align:center;z-index:99;min-width:70px;">
        <div data-tipval="1" style="font-size:14px;font-weight:700;"></div>
        <div data-tiplbl="1" style="font-size:11px;opacity:0.7;"></div>
        <div style="position:absolute;bottom:-6px;left:50%;margin-left:-6px;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:6px solid ${Colors.primary};"></div>
      </div>
    </div>
  `;

  // Attach event listeners via useEffect after DOM mount
  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;
    const el = containerRef.current as unknown as HTMLElement;
    const root = el.querySelector('[data-chart="root"]') as HTMLElement;
    if (!root) return;

    const tip = root.querySelector('[data-tip]') as HTMLElement;
    const tipVal = root.querySelector('[data-tipval]') as HTMLElement;
    const tipLbl = root.querySelector('[data-tiplbl]') as HTMLElement;
    const dots = root.querySelectorAll('[data-dot]');
    const hits = root.querySelectorAll('[data-hit]');

    hits.forEach((hit) => {
      const idx = parseInt(hit.getAttribute('data-hit') || '0');
      const pt = points[idx];
      if (!pt) return;

      hit.addEventListener('mouseenter', () => {
        tip.style.display = 'block';
        tip.style.left = (pt.x - 40) + 'px';
        tip.style.top = (pt.y - 55) + 'px';
        tipVal.textContent = pt.v + ' asesmen';
        tipLbl.textContent = pt.label;
        dots.forEach(d => {
          d.setAttribute('r', d.getAttribute('data-dot') === String(idx) ? '7' : '5');
        });
      });

      hit.addEventListener('mouseleave', () => {
        tip.style.display = 'none';
        dots.forEach(d => d.setAttribute('r', '5'));
      });
    });
  }, [width, height, values.join(',')]);

  if (typeof window !== 'undefined') {
    return (
      <View ref={containerRef} style={{ width, height }}>
        <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
      </View>
    );
  }

  return (
    <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: Colors.textMuted }}>Chart tersedia di web</Text>
    </View>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const [chartW, setChartW]       = useState(0);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [users, setUsers]         = useState<UserRow[]>([]);
  const [loadingDB, setLoadingDB] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [errorDB, setErrorDB]     = useState<string | null>(null);
  const [search, setSearch]       = useState('');

  const adminUser = getStoredUserSync<{ nama: string; email: string; role: string }>();

  useEffect(() => {
    fetchDashboard();
    fetchUsers();
  }, []);

  const fetchDashboard = async () => {
    setLoadingDB(true);
    setErrorDB(null);
    try {
      const data = await apiGetDashboard();
      setDashboard(data);
    } catch (e: unknown) {
      setErrorDB(e instanceof Error ? e.message : 'Gagal memuat dashboard');
    } finally {
      setLoadingDB(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await apiGetAccounts();
      setUsers(data.users);
    } catch {
      // silent — tabel tetap tampil kosong
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleLogout = () => {
    clearAuthSync();
    router.replace('/');
  };

  // Filtered users for search
  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return !q || u.nama?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  // Chart data from weekly_trend
  const trend = dashboard?.weekly_trend ?? [];
  const chartLabels = trend.length
    ? trend.map((t: any) => t.date.slice(5))   // MM-DD
    : ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const chartValues = trend.length ? trend.map((t: any) => t.count) : [0, 0, 0, 0, 0, 0, 0];

  // Metric values
  const totalUsers      = users.length;
  const totalAssessment = dashboard?.total_assessments ?? 0;
  const severeCases     = dashboard?.severity_distribution.severe ?? 0;
  const guardrailHits   = dashboard?.guardrail_trigger_count ?? 0;
  const pendingBookings = dashboard?.pending_bookings.length ?? 0;

  return (
    <View style={styles.container}>

      {/* TOP HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeftFlex}>
          <Text style={styles.headerTitle}>System Overview</Text>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={18} color={Colors.textMuted} />
            <TextInput
              placeholder="Search users, alerts..."
              placeholderTextColor={Colors.textMuted}
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        <View style={styles.headerRight}>
          <InteractiveBtn>
            <View style={styles.iconBtn}>
              <MaterialIcons name="refresh" size={20} color={Colors.textMuted} />
            </View>
          </InteractiveBtn>

          <View style={styles.verticalRule} />

          <View style={styles.profileSection}>
            <View style={{ alignItems: 'flex-end', marginRight: 12 }}>
              <Text style={styles.adminLabel}>{adminUser?.nama ?? 'Admin'}</Text>
              <Text style={styles.adminSub}>{adminUser?.role ?? 'System Administrator'}</Text>
            </View>
            <Pressable onPress={handleLogout} style={styles.logoutBtn}>
              <MaterialIcons name="logout" size={18} color={Colors.error} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* ERROR BANNER */}
      {errorDB && (
        <View style={styles.errorBanner}>
          <MaterialIcons name="error-outline" size={16} color={Colors.error} />
          <Text style={styles.errorBannerTxt}>{errorDB}</Text>
          <Pressable onPress={fetchDashboard}><Text style={styles.retryTxt}>Retry</Text></Pressable>
        </View>
      )}

      {/* MAIN SCROLL */}
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* METRICS */}
        <GlacialAnim delay={0}>
          <View style={styles.metricsGrid}>

            <MetricCard
              icon="group" iconBg="rgba(164,209,248,0.3)" iconColor={Colors.primary}
              badge={`${totalUsers} users`} badgeBg="rgba(164,209,248,0.2)" badgeColor={Colors.primary}
              label="Total Pengguna" value={loadingUsers ? '…' : String(totalUsers)}
              notice="Terdaftar di platform"
            />

            <MetricCard
              icon="assignment" iconBg="rgba(205,206,254,0.3)" iconColor={Colors.tertiary}
              badge="asesmen" badgeBg="rgba(205,206,254,0.2)" badgeColor={Colors.tertiary}
              label="Total Asesmen" value={loadingDB ? '…' : String(totalAssessment)}
              notice="Seluruh periode"
            />

            <MetricCard
              icon="emergency-share" iconBg="rgba(250,116,111,0.2)" iconColor={Colors.error}
              badge={severeCases > 0 ? `+${severeCases}` : '0'} badgeBg="rgba(250,116,111,0.1)" badgeColor={Colors.error}
              label="Kasus Severe" value={loadingDB ? '…' : String(severeCases)}
              notice="Perlu intervensi segera" valueStyle={{ color: Colors.error }}
            />

            <MetricCard
              icon="notifications-active" iconBg="rgba(250,116,111,0.15)" iconColor="#f97316"
              badge={`${pendingBookings} pending`} badgeBg="rgba(249,115,22,0.1)" badgeColor="#f97316"
              label="Guardrail Triggers" value={loadingDB ? '…' : String(guardrailHits)}
              notice={`${pendingBookings} booking menunggu`}
            />

          </View>
        </GlacialAnim>

        {/* CHARTS */}
        <GlacialAnim delay={100}>
          <View style={styles.chartSectionsWrapper}>

            {/* Weekly Trend Chart */}
            <View style={styles.chartBlockPrimary}>
              <View style={styles.chartHeaderBlock}>
                <View>
                  <Text style={styles.chartTitle}>Tren Asesmen Mingguan</Text>
                  <Text style={styles.chartSubtitle}>Jumlah asesmen per hari (7 hari terakhir)</Text>
                </View>
              </View>
              <View
                style={styles.chartBgBox}
                onLayout={(e) => { if (e.nativeEvent.layout.width > 100) setChartW(e.nativeEvent.layout.width); }}
              >
                {loadingDB
                  ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 80 }} />
                  : chartW > 0 && <WebChart labels={chartLabels} values={chartValues} width={chartW} height={240} />
                }
              </View>
            </View>

            {/* Severity Distribution */}
            <View style={styles.chartBlockSecondary}>
              <Text style={styles.chartTitle}>Distribusi Severity</Text>
              <Text style={[styles.chartSubtitle, { marginBottom: 20 }]}>Hasil asesmen seluruh mahasiswa</Text>

              {loadingDB
                ? <ActivityIndicator color={Colors.primary} />
                : (['severe', 'moderate', 'mild', 'minimal'] as const).map((key) => {
                    const val = dashboard?.severity_distribution[key] ?? 0;
                    const pct = totalAssessment > 0 ? Math.round((val / totalAssessment) * 100) : 0;
                    const colMap = { severe: Colors.error, moderate: Colors.tertiary, mild: Colors.primary, minimal: '#10b981' };
                    return (
                      <View key={key} style={{ marginBottom: 14 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textDark, textTransform: 'capitalize' }}>{key}</Text>
                          <Text style={{ fontSize: 12, color: Colors.textMuted }}>{val} ({pct}%)</Text>
                        </View>
                        <View style={{ height: 6, backgroundColor: Colors.border, borderRadius: 99, overflow: 'hidden' }}>
                          <View style={{ width: `${pct}%` as any, height: '100%', backgroundColor: colMap[key], borderRadius: 99 }} />
                        </View>
                      </View>
                    );
                  })
              }
            </View>

          </View>
        </GlacialAnim>

        {/* USER TABLE */}
        <GlacialAnim delay={200}>
          <View style={styles.tableCardContainer}>
            <View style={styles.tableHeaderFlex}>
              <View>
                <Text style={styles.chartTitle}>Manajemen Pengguna</Text>
                <Text style={styles.chartSubtitle}>
                  {loadingUsers ? 'Memuat...' : `${filteredUsers.length} dari ${totalUsers} pengguna terdaftar`}
                </Text>
              </View>
              <View style={styles.tableActionsFilter}>
                <InteractiveBtn>
                  <View style={styles.exportListBtn}>
                    <MaterialIcons name="refresh" size={14} color="#FFF" />
                    <Pressable onPress={() => { fetchDashboard(); fetchUsers(); }}>
                      <Text style={styles.exportListTxt}>Refresh</Text>
                    </Pressable>
                  </View>
                </InteractiveBtn>
              </View>
            </View>

            <View>
              {/* Table head */}
              <View style={styles.theadBox}>
                <Text style={[styles.thCell, { flex: 2.5 }]}>NAMA / EMAIL</Text>
                <Text style={[styles.thCell, { flex: 1 }]}>NIM</Text>
                <Text style={[styles.thCell, { flex: 1.2 }]}>ROLE</Text>
                <Text style={[styles.thCell, { flex: 1.5 }]}>BERGABUNG</Text>
              </View>

              {/* Table body */}
              <View>
                {loadingUsers && (
                  <View style={{ padding: 32, alignItems: 'center' }}>
                    <ActivityIndicator color={Colors.primary} />
                    <Text style={{ color: Colors.textMuted, marginTop: 8, fontSize: 13 }}>Memuat pengguna...</Text>
                  </View>
                )}
                {!loadingUsers && filteredUsers.length === 0 && (
                  <View style={{ padding: 40, alignItems: 'center' }}>
                    <MaterialIcons name="people-outline" size={40} color={Colors.border} />
                    <Text style={{ color: Colors.textMuted, marginTop: 8 }}>
                      {search ? 'Tidak ditemukan' : 'Belum ada pengguna'}
                    </Text>
                  </View>
                )}
                {!loadingUsers && filteredUsers.map((u, idx) => {
                  const roleColor = ROLE_COLOR[u.role] ?? Colors.textMuted;
                  const initials  = (u.nama || u.email).slice(0, 2).toUpperCase();
                  const dateStr   = new Date(u.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                  return (
                    <Pressable
                      key={u.user_id}
                      style={(state: any) => [
                        styles.trBox,
                        state.hovered && { backgroundColor: '#f1f4f9' },
                        idx === filteredUsers.length - 1 && { borderBottomWidth: 0 },
                      ]}
                    >
                      {/* Name/Email col */}
                      <View style={[styles.tdBox, { flex: 2.5, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                        <View style={[styles.avatarCircle, { backgroundColor: roleColor + '20' }]}>
                          <Text style={[styles.avatarTxt, { color: roleColor }]}>{initials}</Text>
                        </View>
                        <View>
                          <Text style={styles.nmTxt} numberOfLines={1}>{u.nama || '—'}</Text>
                          <Text style={styles.deptTxt} numberOfLines={1}>{u.email}</Text>
                        </View>
                      </View>

                      {/* NIM col */}
                      <View style={[styles.tdBox, { flex: 1 }]}>
                        <Text style={styles.tdTxt}>{u.nim || '—'}</Text>
                      </View>

                      {/* Role col */}
                      <View style={[styles.tdBox, { flex: 1.2 }]}>
                        <View style={[styles.rolePill, { backgroundColor: roleColor + '18' }]}>
                          <Text style={[styles.roleTxt, { color: roleColor }]}>{u.role}</Text>
                        </View>
                      </View>

                      {/* Date col */}
                      <View style={[styles.tdBox, { flex: 1.5 }]}>
                        <Text style={styles.tdTxt}>{dateStr}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </GlacialAnim>

      </ScrollView>
    </View>
  );
}

// ── MetricCard component ──────────────────────────────────────────────────────
function MetricCard({ icon, iconBg, iconColor, badge, badgeBg, badgeColor, label, value, notice, valueStyle }: any) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.cardHeaderFlex}>
        <View style={[styles.bentoIcon, { backgroundColor: iconBg }]}>
          <MaterialIcons name={icon} size={24} color={iconColor} />
        </View>
        <View style={[styles.badgePill, { backgroundColor: badgeBg }]}>
          <Text style={[styles.badgeText, { color: badgeColor }]}>{badge}</Text>
        </View>
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricVal, valueStyle]}>{value}</Text>
      <Text style={styles.metricNotice}>{notice}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgApp },
  header: {
    height: 64, backgroundColor: 'rgba(248,249,253,0.9)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 32, position: 'absolute', top: 0, left: 0, right: 0,
    zIndex: 40, backdropFilter: 'blur(16px)' as any,
    shadowColor: Colors.textDark, shadowOpacity: 0.05, shadowRadius: 32,
    shadowOffset: { width: 0, height: 10 }, elevation: 2,
  } as any,
  headerLeftFlex: { flexDirection: 'row', alignItems: 'center', gap: 24, flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.textDark, letterSpacing: -0.5 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', width: 320,
    backgroundColor: '#dde3eb', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textDark, outlineStyle: 'none' as any, marginLeft: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconBtn: { padding: 8, borderRadius: 999 },
  verticalRule: { width: 1, height: 32, backgroundColor: 'rgba(172,179,186,0.2)', marginHorizontal: 4 },
  profileSection: { flexDirection: 'row', alignItems: 'center' },
  adminLabel: { fontSize: 12, fontWeight: '700', color: Colors.textDark },
  adminSub: { fontSize: 10, color: Colors.textMuted },
  logoutBtn: { padding: 8, borderRadius: 8, marginLeft: 8 },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff5f5', paddingHorizontal: 32, paddingVertical: 12,
    marginTop: 64, borderBottomWidth: 1, borderColor: '#fecaca',
  },
  errorBannerTxt: { fontSize: 13, color: Colors.error, flex: 1 },
  retryTxt: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  scrollContent: { padding: 32, paddingTop: 88, gap: 32, alignSelf: 'center', width: '100%' },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  metricCard: {
    flexBasis: 220, flexGrow: 1, backgroundColor: Colors.bgCard, borderRadius: 12, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 24, elevation: 2,
  },
  cardHeaderFlex: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  bentoIcon: { padding: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  badgePill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  metricLabel: { fontSize: 14, fontWeight: '500', color: Colors.textMuted },
  metricVal: { fontSize: 30, fontWeight: '800', color: Colors.textDark, marginTop: 4, letterSpacing: -1 },
  metricNotice: { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic', marginTop: 8 },

  chartSectionsWrapper: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  chartBlockPrimary: {
    flexBasis: 600, flexGrow: 3, backgroundColor: Colors.bgCard, borderRadius: 12, padding: 32,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 24, elevation: 2,
  },
  chartBlockSecondary: {
    flexBasis: 280, flexGrow: 1, backgroundColor: Colors.bgCard, borderRadius: 12, padding: 32,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 24, elevation: 2,
  },
  chartHeaderBlock: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
  chartTitle: { fontSize: 18, fontWeight: '700', color: Colors.textDark, letterSpacing: -0.5 },
  chartSubtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  chartBgBox: { minHeight: 240, overflow: 'visible' },

  tableCardContainer: {
    backgroundColor: Colors.bgCard, borderRadius: 16, overflow: 'hidden',
    shadowColor: Colors.textDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 32,
  },
  tableHeaderFlex: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 24 },
  tableActionsFilter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  exportListBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
  },
  exportListTxt: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  theadBox: { flexDirection: 'row', backgroundColor: '#f1f4f9', paddingHorizontal: 24, paddingVertical: 16 },
  thCell: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1 },
  trBox: {
    flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 14,
    borderBottomWidth: 1, borderColor: Colors.border, transition: 'all 0.15s',
  } as any,
  tdBox: { justifyContent: 'center' },
  avatarCircle: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 13, fontWeight: '800' },
  nmTxt: { fontSize: 14, fontWeight: '700', color: Colors.textDark },
  deptTxt: { fontSize: 10, color: Colors.textMuted },
  rolePill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  roleTxt: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  tdTxt: { fontSize: 13, fontWeight: '500', color: Colors.textMuted },
});


