import type {ReactNode} from 'react';
import {AuthGuard} from '@/components/auth/AuthGuard';
import {AppShell} from '@/components/shell/AppShell';

export default function CounselorLayout({children}: {children: ReactNode}) {
  return <AuthGuard roles={['konselor']}><AppShell><div className="counselor-portal">{children}</div></AppShell></AuthGuard>;
}
