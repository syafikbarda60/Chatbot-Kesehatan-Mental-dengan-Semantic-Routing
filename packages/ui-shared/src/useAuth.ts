// hooks/useAuth.ts
// Auth state management — login, logout, load persisted user.

import { useState, useEffect, useCallback } from 'react';
import { apiLogin, apiLogout, getStoredUser, type LoginPayload, type LoginResponse } from '@prototype/api-client';

export interface AuthUser {
  user_id: string;
  email: string;
  name: string;
  nim?: string;
  role: 'mahasiswa' | 'konselor' | 'admin' | 'pemangku_jabatan';
}

export interface UseAuthReturn {
  user: AuthUser | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  error: string | null;
  login: (payload: LoginPayload) => Promise<LoginResponse>;
  logout: () => Promise<void>;
}

// Every useAuth() keeps its own copy of the user. This keeps the copies in step, so a
// component mounted before sign-in (the root layout's privacy walkthrough) learns who signed
// in without an app restart. A listener set, not a context — no provider to thread.
const listeners = new Set<(u: AuthUser | null) => void>();
const broadcast = (u: AuthUser | null) => listeners.forEach((l) => l(u));

export function useAuth(): UseAuthReturn {
  const [user, setUser]         = useState<AuthUser | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError]       = useState<string | null>(null);

  // Load persisted user on mount, then follow sign-ins and sign-outs from anywhere
  useEffect(() => {
    listeners.add(setUser);
    getStoredUser<AuthUser>().then((u: AuthUser | null) => {
      setUser(u);
      setLoading(false);
    });
    return () => { listeners.delete(setUser); };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiLogin(payload);
      broadcast(data.user as AuthUser);
      return data;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Login gagal';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    broadcast(null);
  }, []);

  return {
    user,
    isLoading,
    isLoggedIn: !!user,
    error,
    login,
    logout,
  };
}

