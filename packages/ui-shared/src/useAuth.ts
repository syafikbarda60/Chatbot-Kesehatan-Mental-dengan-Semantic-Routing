// hooks/useAuth.ts
// Auth state management — login, logout, load persisted user.

import { useState, useEffect, useCallback } from 'react';
import { apiLogin, getStoredUser, clearAuth, type LoginPayload, type LoginResponse } from '@prototype/api-client';

export interface AuthUser {
  user_id: string;
  email: string;
  nama: string;
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

export function useAuth(): UseAuthReturn {
  const [user, setUser]         = useState<AuthUser | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError]       = useState<string | null>(null);

  // Load persisted user on mount
  useEffect(() => {
    getStoredUser<AuthUser>().then((u: AuthUser | null) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiLogin(payload);
      setUser(data.user as AuthUser);
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
    await clearAuth();
    setUser(null);
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

