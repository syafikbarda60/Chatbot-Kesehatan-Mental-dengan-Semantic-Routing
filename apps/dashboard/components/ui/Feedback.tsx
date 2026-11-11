import Image from 'next/image';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';

export function InlineAlert({ tone = 'info', title, children }: { tone?: 'info' | 'warning' | 'danger' | 'success'; title?: string; children: ReactNode }) {
  const icon: IconName = tone === 'danger' || tone === 'warning' ? 'alert' : tone === 'success' ? 'check' : 'info';
  return <div className={`alert alert-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}><Icon name={icon} /><div>{title && <strong>{title}</strong>}<div>{children}</div></div></div>;
}

export function LoadingState({ label = 'Memuat…', fullPage = false }: { label?: string; fullPage?: boolean }) {
  return <div className={`state-panel ${fullPage ? 'state-full-page' : ''}`} role="status" aria-live="polite"><span className="spinner spinner-large" aria-hidden="true" /><p>{label}</p></div>;
}

export function ErrorState({ title, message, retry, retryLabel = 'Coba lagi' }: { title: string; message: string; retry?: () => void; retryLabel?: string }) {
  return <div className="state-panel" role="alert"><Image className="state-mascot" src="/character/bingung.png" alt="" width={96} height={96} /><h1>{title}</h1><p>{message}</p>{retry && <Button variant="secondary" onClick={retry}>{retryLabel}</Button>}</div>;
}

export function EmptyState({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  return <div className="state-panel"><Image className="state-mascot" src="/character/tenang.png" alt="" width={96} height={96} /><h2>{title}</h2>{message && <p>{message}</p>}{action}</div>;
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return <div className="skeleton-stack" aria-hidden="true">{Array.from({ length: lines }, (_, index) => <div className="skeleton" key={index} style={{ width: `${100 - index * 12}%` }} />)}</div>;
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'info' | 'warning' | 'danger' | 'success' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
