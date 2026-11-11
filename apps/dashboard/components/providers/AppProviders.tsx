'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { LanguageProvider } from '@/components/providers/LanguageProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return <ThemeProvider><LanguageProvider><AuthProvider>{children}</AuthProvider></LanguageProvider></ThemeProvider>;
}
