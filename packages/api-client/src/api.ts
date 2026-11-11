import { Platform } from 'react-native';
import { fetch as streamFetch } from 'expo/fetch';
import { getToken, saveToken, saveUser, clearAuth } from './storage';

let unauthorizedCallback: (() => void) | null = null;

export function setUnauthorizedCallback(callback: () => void) {
  unauthorizedCallback = callback;
}

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || (__DEV__
  ? (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000')
  : 'https://your-production-url.com');

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = 'ApiError'; }
}

interface FetchOptions extends RequestInit {
  auth?: boolean;
  base?: string;
}

async function authHeader(): Promise<Record<string, string>> {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Drop a token the server has rejected, so the app asks for a login instead of retrying with
 * it. Every authenticated response goes through this: a token can stop being valid without
 * expiring — its account may be deleted, or the database rebuilt under it — and the stream
 * path used to only throw, leaving the session stuck until the token's own expiry.
 */
async function handleUnauthorized(status: number): Promise<void> {
  if (status !== 401) return;
  await clearAuth();
  unauthorizedCallback?.();
}

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { auth = true, base = API_BASE_URL, ...fetchOpts } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(auth ? await authHeader() : {}),
    ...(fetchOpts.headers as Record<string, string> || {}),
  };

  const res = await fetch(`${base}${path}`, { ...fetchOpts, headers });

  if (!res.ok) {
    if (auth) await handleUnauthorized(res.status);

    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      detail = err.detail || JSON.stringify(err);
    } catch {}
    throw new ApiError(res.status, detail);
  }

  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

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
    name: string;
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

export async function apiLogout(): Promise<void> {
  // MASVS-AUTH-1: revoke the token on the server first; forgetting it locally left a copied
  // token valid until expiry. Offline or already-expired: still log out on this device.
  // auth:false keeps a 401 here from re-entering the unauthorized callback, which logs out.
  const token = await getToken();
  if (token) {
    try {
      await apiFetch('/auth/logout', { method: 'POST', auth: false, headers: { Authorization: `Bearer ${token}` } });
    } catch {}
  }
  await clearAuth();
}

// The privacy walkthrough is shown once per account; the acceptance lives on the server.
export type PrivacyConsent = { accepted_at: string | null };
export const apiGetPrivacyConsent = () => apiFetch<PrivacyConsent>('/auth/consent');
export const apiAcceptPrivacyConsent = () => apiFetch<PrivacyConsent>('/auth/consent', { method: 'POST' });

export async function apiRegister(payload: any) {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
    auth: false,
  });
}

export async function apiRequestPasswordReset(email: string) {
  return apiFetch('/auth/reset-password/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
    auth: false,
  });
}

export async function apiConfirmPasswordReset(email: string, otp: string, new_password: string) {
  return apiFetch('/auth/reset-password/confirm', {
    method: 'POST',
    body: JSON.stringify({ email, otp, new_password }),
    auth: false,
  });
}

// ── Guardrail / Hotline ────────────────────────────────────────────────────────

export async function apiGetHotline() {
  return apiFetch<{ hotlines: { name: string; phone: string; description?: string }[] }>(
    '/guardrail/hotline',
    { auth: false }
  );
}

export async function apiCheckGuardrail(message: string) {
  return apiFetch<{ is_high_risk: boolean; route: string; response: string | null }>(
    '/guardrail/check',
    { method: 'POST', body: JSON.stringify({ message }) }
  );
}

// ── Chat ───────────────────────────────────────────────────────────────────────

export interface ChatPayload {
  message: string;
  session_id?: string;
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  text: string;
  route: string | null;
  created_at: string;
}

/** The caller's own transcript, decrypted server-side. Scoped to the JWT identity. */
export async function apiChatHistory(
  sessionId: string,
  limit = 50
): Promise<{ session_id: string; messages: ChatHistoryMessage[] }> {
  return apiFetch(
    `/chat/history?session_id=${encodeURIComponent(sessionId)}&limit=${limit}`
  );
}

export interface ChatSessionSummary {
  session_id: string;
  /** The conversation's first user message, tidied and cut to 80 characters; null if none. */
  preview: string | null;
  started_at: string;
  last_message_at: string | null;
}

/** The caller's own conversations, most recently active first. */
export async function apiChatSessions(limit = 30): Promise<{ sessions: ChatSessionSummary[] }> {
  return apiFetch(`/chat/sessions?limit=${limit}`);
}

export interface ChatStreamEvent {
  /** One token, present on most frames. */
  token?: string;
  /** Only on the first frame. */
  route?: string;
  is_high_risk?: boolean;
  /** Only if generation failed mid-stream. */
  error?: string;
}

/**
 * Stream a reply. `onEvent` fires per frame; the promise resolves at `[DONE]`.
 *
 * Uses `expo/fetch` because React Native's global fetch buffers the whole response — on web
 * that module is just `globalThis.fetch`, so both platforms take this path.
 */
export async function apiChatStream(
  payload: ChatPayload,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await streamFetch(`${API_BASE_URL}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    await handleUnauthorized(res.status);
    throw new ApiError(res.status, `HTTP ${res.status}`);
  }
  if (!res.body) throw new ApiError(res.status, 'Respons tidak bisa di-stream');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sawDone = false;

  while (!sawDone) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE frames end at a blank line; hold the trailing partial frame for the next read.
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      const line = frame.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      const raw = line.slice(5).trim();
      if (raw === '[DONE]') {
        sawDone = true;
        break;
      }
      try {
        onEvent(JSON.parse(raw) as ChatStreamEvent);
      } catch {
        // Keep-alive or partial frame: not an error.
      }
    }
  }

  // A completed stream always ends with [DONE]; a bare EOF means the connection dropped, so
  // surface it instead of leaving a silently truncated reply on screen.
  if (!sawDone) throw new ApiError(0, 'stream terputus');
}

/** Crisis sheet "Kabari tim Sajiwa": logs an unread safety signal for counselors. */
export async function apiReportToTeam(session_id?: string) {
  return apiFetch<{ status: string }>('/chat/report', {
    method: 'POST',
    body: JSON.stringify({ session_id }),
  });
}

// ── Assessment ─────────────────────────────────────────────────────────────────

export interface AnswerItem {
  question_id: number;
  score: number;
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

// ── Jadwal / Booking ───────────────────────────────────────────────────────────

export interface JadwalSlot {
  counseling_slot_id: string;
  counselor_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
}

export async function apiGetJadwal(): Promise<{ jadwal: JadwalSlot[] }> {
  return apiFetch('/jadwal');
}

export async function apiBuatBooking(counseling_slot_id: string, notes?: string) {
  return apiFetch('/booking', {
    method: 'POST',
    body: JSON.stringify({ counseling_slot_id, notes }),
  });
}

export async function apiGetBookingSaya() {
  return apiFetch<{ bookings: object[] }>('/booking/saya');
}

// ── Dashboard / Operator ───────────────────────────────────────────────────────

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
  pending_bookings: { counseling_booking_id: string; student_id: string; created_at: string }[];
}

export async function apiGetDashboard(): Promise<DashboardData> {
  return apiFetch<DashboardData>('/dashboard/data');
}

export interface UserRow {
  user_id: string;
  name: string;
  email: string;
  nim?: string;
  role: string;
  created_at: string;
  faculty_id?: string | null;
  faculty_name?: string | null;
  academic_unit_id?: string | null;
  academic_unit_name?: string | null;
  unit_type?: 'department' | 'study_program' | null;
}

export async function apiGetAccounts(): Promise<{ users: UserRow[]; total: number }> {
  return apiFetch<{ users: UserRow[]; total: number }>('/accounts');
}

/** Counselor directory for the booking screen (public fields only). */
export async function apiGetKonselor(): Promise<{ users: UserRow[] }> {
  return apiFetch<{ users: UserRow[] }>('/accounts/konselor');
}

// ── Journaling ─────────────────────────────────────────────────────────────────

export interface JournalPayload {
  content: string;
  mood?: 'calm' | 'anxious' | 'focused' | 'tired';
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

export async function apiGetJournals(limit = 20, offset = 0) {
  return apiFetch<{ journals: any[] }>(`/journal?limit=${limit}&offset=${offset}`);
}

export async function apiUpdateJournal(journal_id: string, payload: Partial<JournalPayload>) {
  return apiFetch(`/journal/${journal_id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function apiDeleteJournal(journal_id: string) {
  return apiFetch(`/journal/${journal_id}`, { method: 'DELETE' });
}
