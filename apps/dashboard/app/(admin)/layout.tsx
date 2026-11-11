import type { ReactNode } from 'react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/shell/AppShell';

export default function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <AuthGuard roles={['admin']}><AppShell>{children}</AppShell></AuthGuard>;
}
