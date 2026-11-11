import type { IconName } from '@/components/ui/Icon';

export type NavKey = 'overview' | 'monitoring' | 'students' | 'counseling' | 'counselors' | 'analytics' | 'instruments' | 'hotline' | 'settings';
export type NavGroupKey = 'home' | 'monitoring' | 'counseling' | 'analysis' | 'system';
export interface NavItem { key: NavKey; href: string; icon: IconName }
export interface NavGroup { key: NavGroupKey; items: NavItem[] }

export const navigation: NavGroup[] = [
  { key: 'home', items: [{ key: 'overview', href: '/overview', icon: 'home' }] },
  { key: 'monitoring', items: [{ key: 'monitoring', href: '/monitoring', icon: 'monitoring' }, { key: 'students', href: '/students', icon: 'students' }] },
  { key: 'counseling', items: [{ key: 'counseling', href: '/counseling', icon: 'calendar' }, { key: 'counselors', href: '/counselors', icon: 'counselor' }] },
  { key: 'analysis', items: [{ key: 'analytics', href: '/analytics', icon: 'analytics' }] },
  { key: 'system', items: [{ key: 'instruments', href: '/instruments', icon: 'instrument' }, { key: 'hotline', href: '/hotline', icon: 'phone' }, { key: 'settings', href: '/settings', icon: 'settings' }] },
];

export type CounselorNavKey = 'counselorHome'|'counselorStudents'|'counselorSchedule'|'counselorAvailability'|'counselorReviews'|'counselorSettings';
export interface CounselorNavItem { key: CounselorNavKey; href: string; icon: IconName }
export const counselorNavigation: Array<{key:'home'|'services'|'validation'|'account';items:CounselorNavItem[]}> = [
  {key:'home',items:[{key:'counselorHome',href:'/counselor',icon:'home'}]},
  {key:'services',items:[{key:'counselorStudents',href:'/counselor/students',icon:'students'},{key:'counselorSchedule',href:'/counselor/schedule',icon:'calendar'},{key:'counselorAvailability',href:'/counselor/availability',icon:'counselor'}]},
  {key:'validation',items:[{key:'counselorReviews',href:'/counselor/reviews',icon:'instrument'}]},
  {key:'account',items:[{key:'counselorSettings',href:'/counselor/settings',icon:'settings'}]},
];

export function navigationForRole(role: 'admin'|'konselor') {
  return role === 'konselor' ? counselorNavigation : navigation;
}

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Longest match wins: /counselor/schedule belongs to "Jadwal Saya", not to the /counselor home above it.
export function activeNavItem<T extends { href: string }>(pathname: string, groups: readonly { items: readonly T[] }[]): T | undefined {
  return groups.flatMap((group) => group.items).filter((item) => isActivePath(pathname, item.href)).sort((a, b) => b.href.length - a.href.length)[0];
}
