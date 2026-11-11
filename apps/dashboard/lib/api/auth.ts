import { apiRequest } from '@/lib/api/client';
import type { AuthenticatedUser } from '@/lib/auth/session';

export interface LoginRequest { email: string; password: string }
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: AuthenticatedUser;
}

export function login(payload: LoginRequest): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/login', { method: 'POST', auth: false, body: payload });
}

export function getCurrentUser(): Promise<AuthenticatedUser> {
  return apiRequest<AuthenticatedUser>('/auth/me');
}
