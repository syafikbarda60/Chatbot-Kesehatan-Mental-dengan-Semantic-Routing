'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import { ErrorState } from '@/components/ui';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { text } = useLanguage();
  return <main className="boundary-page"><ErrorState title={text.errors.title} message={text.errors.body} retry={reset} retryLabel={text.common.retry} /></main>;
}
