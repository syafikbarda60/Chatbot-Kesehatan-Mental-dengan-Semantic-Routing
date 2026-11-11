'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, AUTH_EXPIRED_EVENT } from '@/lib/api/client';
import { getCurrentUser, login as loginRequest, type LoginRequest } from '@/lib/api/auth';
import { clearSession, isPortalRole, readSession, writeSession, type AuthenticatedUser } from '@/lib/auth/session';
import { getPreviewUser, isPreviewMode, setPreviewRole, type PreviewRole } from '@/lib/previewMode';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'unauthorized' | 'expired' | 'unavailable';
interface AuthContextValue { status: AuthStatus; user: AuthenticatedUser | null; login: (payload: LoginRequest) => Promise<void>; logout: () => void; refresh: () => Promise<void>; switchPreviewRole: (role: PreviewRole) => void }
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  const refresh = useCallback(async () => {
    if (isPreviewMode()) { setUser(getPreviewUser()); setStatus('authenticated'); return; }
    const session = readSession();
    if (!session) { setUser(null); setStatus('unauthenticated'); return; }
    setStatus('loading');
    try {
      const profile = await getCurrentUser();
      setUser(profile);
      setStatus(isPortalRole(profile.role) ? 'authenticated' : 'unauthorized');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) { clearSession(); setUser(null); setStatus('expired'); return; }
      if (error instanceof ApiError && error.status === 403) { setUser(session.user); setStatus('unauthorized'); return; }
      setUser(session.user); setStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const expire = () => { clearSession(); setUser(null); setStatus('expired'); };
    window.addEventListener(AUTH_EXPIRED_EVENT, expire);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, expire);
  }, []);

  const login = useCallback(async (payload: LoginRequest) => {
    if (isPreviewMode()) { clearSession(); setUser(getPreviewUser()); setStatus('authenticated'); return; }
    const response = await loginRequest(payload);
    if (!isPortalRole(response.user.role)) { clearSession(); setUser(response.user); setStatus('unauthorized'); return; }
    writeSession({ accessToken: response.access_token, user: response.user });
    setUser(response.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(() => { clearSession(); setUser(null); setStatus('unauthenticated'); }, []);
  const switchPreviewRole = useCallback((role: PreviewRole) => {
    if (!isPreviewMode()) return;
    setUser(setPreviewRole(role));
    setStatus('authenticated');
  }, []);
  const value = useMemo(() => ({ status, user, login, logout, refresh, switchPreviewRole }), [status, user, login, logout, refresh, switchPreviewRole]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
