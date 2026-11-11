import type { ReactNode } from 'react';

export function PageShell({ title, description, actions, filters, children }: { title?: string; description?: ReactNode; actions?: ReactNode; filters?: ReactNode; children: ReactNode }) {
  return <div className="page-shell">{(title || actions) && <header className="page-header"><div className="page-heading">{title && <h1>{title}</h1>}{description && <div className="page-description">{description}</div>}</div>{actions && <div className="page-actions">{actions}</div>}</header>}{filters && <div className="page-filters">{filters}</div>}<div className="page-content">{children}</div></div>;
}
