'use client';

import { useCallback, useRef, type ReactNode } from 'react';
import { IconButton } from '@/components/ui/Button';
import { useModalFocus } from '@/components/ui/focus';

export function Drawer({ open, onOpenChange, title, description, children, footer, closeLabel = 'Tutup', className = '' }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: ReactNode; footer?: ReactNode; closeLabel?: string; className?: string }) {
  const panel = useRef<HTMLElement>(null);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  useModalFocus(open, panel, close);
  if (!open) return null;
  return <div className="overlay"><button className="overlay-dismiss" tabIndex={-1} aria-label={closeLabel} onClick={close} /><aside ref={panel} className={`drawer ${className}`} role="dialog" aria-modal="true" aria-labelledby="drawer-title" aria-describedby={description ? 'drawer-description' : undefined}><header className="drawer-header"><div><h2 id="drawer-title">{title}</h2>{description && <p id="drawer-description">{description}</p>}</div><IconButton label={closeLabel} icon="close" onClick={close} /></header><div className="drawer-body">{children}</div>{footer && <footer className="drawer-footer">{footer}</footer>}</aside></div>;
}
