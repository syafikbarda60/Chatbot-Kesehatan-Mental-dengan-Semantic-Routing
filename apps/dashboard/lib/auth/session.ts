export type SajiwaRole = 'mahasiswa' | 'konselor' | 'admin' | 'pemangku_jabatan';

export interface AuthenticatedUser {
  user_id: string;
  email: string;
  name: string;
  nim?: string;
  role: SajiwaRole;
}

export interface StoredSession {
  accessToken: string;
  user: AuthenticatedUser;
}

const SESSION_KEY = 'sajiwa_admin_session';

function storage(): Storage | null {
  return typeof window === 'undefined' ? null : window.sessionStorage;
}

export function readSession(): StoredSession | null {
  const store = storage();
  if (!store) return null;
  const value = store.getItem(SESSION_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as StoredSession;
  } catch {
    store.removeItem(SESSION_KEY);
    return null;
  }
}

export function writeSession(session: StoredSession): void {
  storage()?.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  storage()?.removeItem(SESSION_KEY);
}

export function isAdminRole(role: SajiwaRole): boolean {
  return role === 'admin';
}

export function isPortalRole(role: SajiwaRole): boolean {
  return role === 'admin' || role === 'konselor';
}
