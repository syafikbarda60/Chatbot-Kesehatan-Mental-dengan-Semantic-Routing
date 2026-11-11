'use client';

import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { ErrorState } from '@/components/ui';

export default function NotFound() {
  const { text } = useLanguage();
  return <main className="boundary-page"><ErrorState title={text.errors.notFound} message={text.errors.notFoundBody} /><Link className="button button-primary" href="/overview">{text.nav.overview}</Link></main>;
}
