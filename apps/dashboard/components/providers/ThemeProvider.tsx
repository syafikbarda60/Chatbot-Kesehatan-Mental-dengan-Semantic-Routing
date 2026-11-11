'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isThemeMode, resolveTheme, type ResolvedTheme, type ThemeMode } from '@/lib/theme/theme';

const STORAGE_KEY = 'sajiwa_theme';
interface ThemeContextValue { mode: ThemeMode; resolved: ResolvedTheme; setMode: (mode: ThemeMode) => void }
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isThemeMode(stored)) setModeState(stored);
      update();
    }, 0);
    media.addEventListener('change', update);
    return () => {
      window.clearTimeout(timer);
      media.removeEventListener('change', update);
    };
  }, []);

  const resolved = resolveTheme(mode, systemDark);
  useEffect(() => { document.documentElement.dataset.theme = resolved; document.documentElement.style.colorScheme = resolved; }, [resolved]);
  const setMode = useCallback((next: ThemeMode) => { setModeState(next); window.localStorage.setItem(STORAGE_KEY, next); }, []);
  const value = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
