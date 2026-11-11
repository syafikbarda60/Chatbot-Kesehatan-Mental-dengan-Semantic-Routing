'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import { PageShell } from '@/components/ui';

interface MigrationPlaceholderProps {
  title: string;
  description?: string;
}

export function MigrationPlaceholder({ title, description }: MigrationPlaceholderProps) {
  const { text } = useLanguage();

  return (
    <PageShell title={title}>
      <section className="migration-placeholder" aria-labelledby="migration-title">
        <div>
          <p className="eyebrow">{text.placeholder.eyebrow}</p>
          <h2 id="migration-title">{title}</h2>
          <p>{description ?? text.placeholder.body}</p>
        </div>
      </section>
    </PageShell>
  );
}
