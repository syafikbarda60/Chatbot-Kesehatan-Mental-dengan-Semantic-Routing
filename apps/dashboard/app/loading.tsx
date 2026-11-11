'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import { LoadingState } from '@/components/ui';

export default function Loading() {
  const { text } = useLanguage();
  return <LoadingState fullPage label={`${text.common.loading} Sajiwa…`} />;
}
