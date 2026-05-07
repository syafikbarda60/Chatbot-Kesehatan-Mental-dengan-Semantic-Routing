/**
 * dashboard-web/utils/api.ts
 * API client untuk dashboard web — pakai localStorage (bukan AsyncStorage).
 */

export const API_BASE = 'http://localhost:8000';

// ── Storage ──────────────────────────────────────────────────────────────────

export function saveToken(token: string) {
  if (typeof window !== 'undefined') localStorage.setItem('sanctuary_token', token);
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('sanctuary_token');
}

export function saveUser(user: object) {
  if (typeof window !== 'undefined') localStorage.setItem('sanctuary_user', JSON.stringify(user));
}

export function getStoredUser<T = Record<string, unknown>>(): T | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('sanctuary_user');
  return raw ? JSON.parse(raw) : null;
}

export function clearAuth() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('sanctuary_token');
    localStorage.removeItem('sanctuary_user');
  }
}

// ── Core fetch ────────────────────────────────────────────────────────────────

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const { auth = true, ...fetchOpts } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOpts.headers as Record<string, string> || {}),
  };
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...fetchOpts, headers });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const err = await res.json(); detail = err.detail || JSON.stringify(err); } catch {}
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: {
    user_id: string;
    email: string;
    nama: string;
    nim?: string;
    role: 'mahasiswa' | 'konselor' | 'admin' | 'pemangku_jabatan';
  };
}

export async function apiLogin(email: string, password: string): Promise<LoginResponse> {
  const data = await apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    auth: false,
  });
  saveToken(data.access_token);
  saveUser(data.user);
  return data;
}

// ── Dashboard data (CB-10) ────────────────────────────────────────────────────

export interface DashboardData {
  total_assessments: number;
  severity_distribution: {
    minimal: number;
    mild: number;
    moderate: number;
    severe: number;
  };
  weekly_trend: { date: string; count: number }[];
  recent_severe: { assessment_id: string; user_id: string; score: number; taken_at: string }[];
  guardrail_trigger_count: number;
  pending_bookings: { booking_id: string; user_id: string; created_at: string }[];
}

export async function apiGetDashboard(): Promise<DashboardData> {
  return apiFetch<DashboardData>('/dashboard/data');
}

// ── Accounts (CB-11) ──────────────────────────────────────────────────────────

export interface UserRow {
  user_id: string;
  nama: string;
  email: string;
  nim?: string;
  role: string;
  created_at: string;
}

export async function apiGetAccounts(): Promise<{ users: UserRow[]; total: number }> {
  return apiFetch<{ users: UserRow[]; total: number }>('/accounts');
}
