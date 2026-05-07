// utils/api.ts
// Central API client for Sanctuary backend.
// All fetch calls go through here — token management, base URL, error handling.

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Config ────────────────────────────────────────────────────────────────────
// Ganti sesuai environment:
//   Web/browser    → 'http://localhost:8000'
//   Android emu    → 'http://10.0.2.2:8000'
//   Device fisik   → 'http://192.168.x.x:8000'  (IP lokal komputer)
export const API_BASE_URL = __DEV__
  ? (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000')
  : 'https://your-production-url.com';

const TOKEN_KEY = 'sanctuary_access_token';
const USER_KEY  = 'sanctuary_user';

// ── Token storage ─────────────────────────────────────────────────────────────

export async function saveToken(token: string) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function clearToken() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

export async function saveUser(user: object) {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getUser<T = Record<string, unknown>>(): Promise<T | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

interface FetchOptions extends RequestInit {
  auth?: boolean;   // tambah Authorization header otomatis (default true)
  base?: string;    // override base URL
}

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { auth = true, base = API_BASE_URL, ...fetchOpts } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOpts.headers as Record<string, string> || {}),
  };

  if (auth) {
    const token = await getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${base}${path}`, { ...fetchOpts, headers });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      detail = err.detail || JSON.stringify(err);
    } catch {}
    throw new Error(detail);
  }

  return res.json() as Promise<T>;
}

// ── CB-09: login ──────────────────────────────────────────────────────────────

export interface LoginPayload {
  email: string;
  password: string;
}

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

export async function apiLogin(payload: LoginPayload): Promise<LoginResponse> {
  const data = await apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
    auth: false,
  });
  await saveToken(data.access_token);
  await saveUser(data.user);
  return data;
}

export async function apiLogout() {
  await clearToken();
}

export async function apiRegister(payload: any) {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
    auth: false,
  });
}

// ── CB-03: hotline ────────────────────────────────────────────────────────────

export async function apiGetHotline() {
  return apiFetch<{ hotlines: { nama: string; nomor: string; deskripsi?: string }[] }>(
    '/guardrail/hotline',
    { auth: false }
  );
}

// ── CB-04: guardrail check ────────────────────────────────────────────────────

export async function apiCheckGuardrail(message: string) {
  return apiFetch<{ is_high_risk: boolean; route: string; response: string | null }>(
    '/guardrail/check',
    { method: 'POST', body: JSON.stringify({ message }) }
  );
}

// ── POST /chat — unified chat (CB-04+05+07+08) ────────────────────────────────

export interface ChatPayload {
  message: string;
  session_id?: string;
}

export interface ChatResponse {
  response: string;
  route: string;
  is_high_risk: boolean;
}

export async function apiChat(payload: ChatPayload): Promise<ChatResponse> {
  return apiFetch<ChatResponse>('/chat', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── CB-01: submit assessment ──────────────────────────────────────────────────

export interface AnswerItem {
  question_id: number;
  score: number;  // 0–3
}

export interface AssessmentPayload {
  answers: AnswerItem[];
  instrument_type: 'PHQ-9' | 'GAD-7' | 'SRQ' | 'custom';
  session_id?: string;
}

export async function apiSubmitAssessment(payload: AssessmentPayload) {
  return apiFetch('/assessment/submit', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── Jadwal & Booking ──────────────────────────────────────────────────────────

export async function apiGetJadwal() {
  return apiFetch<{ jadwal: object[] }>('/jadwal');
}

export async function apiBuatBooking(jadwal_id: string, catatan?: string) {
  return apiFetch('/booking', {
    method: 'POST',
    body: JSON.stringify({ jadwal_id, catatan }),
  });
}

export async function apiGetBookingSaya() {
  return apiFetch<{ bookings: object[] }>('/booking/saya');
}

// ── Dashboard (operator/konselor) ─────────────────────────────────────────────

export async function apiGetDashboard() {
  return apiFetch('/dashboard/data');
}

// ── Journaling (CB-14+) ───────────────────────────────────────────────────────

export interface JournalPayload {
  content: string;
  mood?: 'Calm' | 'Anxious' | 'Focused' | 'Tired';
}

export async function apiSaveJournal(payload: JournalPayload) {
  return apiFetch('/journal', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiGetTodayJournal() {
  return apiFetch<{ journal: { content: string; mood: string } | null }>('/journal/today');
}

export async function apiGetJournals() {
  return apiFetch<{ journals: any[] }>('/journal');
}
