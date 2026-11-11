import type {SajiwaRole} from './session';

export function roleHome(role: SajiwaRole): '/counselor' | '/overview' {
  return role === 'konselor' ? '/counselor' : '/overview';
}

export function roleRedirect(role: SajiwaRole, allowedRoles?: readonly SajiwaRole[]): '/counselor' | '/overview' | null {
  return allowedRoles && !allowedRoles.includes(role) ? roleHome(role) : null;
}
