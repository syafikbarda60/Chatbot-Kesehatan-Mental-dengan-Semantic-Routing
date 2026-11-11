'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isLanguage, messages, type Language, type Messages } from '@/lib/i18n/messages';

const STORAGE_KEY = 'sajiwa_language';
interface LanguageContextValue { language: Language; text: Messages; setLanguage: (language: Language) => void }
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('id');
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isLanguage(stored)) setLanguageState(stored);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const setLanguage = useCallback((next: Language) => { setLanguageState(next); window.localStorage.setItem(STORAGE_KEY, next); document.documentElement.lang = next; }, []);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const value = useMemo(() => ({ language, text: messages[language], setLanguage }), [language, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider');
  return value;
}
