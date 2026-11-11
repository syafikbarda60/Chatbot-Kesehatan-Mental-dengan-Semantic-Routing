import type { AuthenticatedUser } from './auth/session';

export const PREVIEW_ADMIN: AuthenticatedUser = {
  user_id: 'preview-admin-local',
  name: 'Preview Administrator',
  email: 'preview@sajiwa.local',
  role: 'admin',
};

export const PREVIEW_COUNSELOR: AuthenticatedUser = {
  user_id: 'preview-counselor-01',
  name: 'Konselor Preview',
  email: 'konselor.preview@sajiwa.local',
  role: 'konselor',
};

export type PreviewRole = 'admin' | 'konselor';
export const PREVIEW_ROLE_KEY = 'sajiwa.preview.role';

export function resolvePreviewRole(value: string | null | undefined): PreviewRole {
  return value === 'konselor' ? 'konselor' : 'admin';
}

export function previewUserForRole(role: PreviewRole): AuthenticatedUser {
  return role === 'konselor' ? PREVIEW_COUNSELOR : PREVIEW_ADMIN;
}

export function getPreviewRole(): PreviewRole {
  return resolvePreviewRole(typeof window === 'undefined' ? null : window.sessionStorage.getItem(PREVIEW_ROLE_KEY));
}

export function getPreviewUser(): AuthenticatedUser { return previewUserForRole(getPreviewRole()); }
export function setPreviewRole(role: PreviewRole): AuthenticatedUser {
  if (typeof window !== 'undefined') window.sessionStorage.setItem(PREVIEW_ROLE_KEY, role);
  return previewUserForRole(role);
}

export function resolvePreviewMode(nodeEnv: string | undefined, flag: string | undefined): boolean {
  return nodeEnv === 'development' && flag === 'true';
}

export function isPreviewMode(): boolean {
  return resolvePreviewMode(process.env.NODE_ENV, process.env.NEXT_PUBLIC_PREVIEW_MODE);
}
