'use client';

import { useCallback, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { useModalFocus } from '@/components/ui/focus';

export function ConfirmationDialog({ open, onOpenChange, title, consequence, cancelLabel = 'Batal', confirmLabel, onConfirm, danger = false }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; consequence: ReactNode; cancelLabel?: string; confirmLabel: string; onConfirm: () => void; danger?: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  useModalFocus(open, panel, close);
  if (!open) return null;
  return <div className="overlay overlay-centered"><button className="overlay-dismiss" tabIndex={-1} aria-label={cancelLabel} onClick={close} /><div ref={panel} className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-description"><h2 id="dialog-title">{title}</h2><div id="dialog-description" className="dialog-description">{consequence}</div><div className="dialog-actions"><Button variant="ghost" onClick={close}>{cancelLabel}</Button><Button variant={danger ? 'danger' : 'primary'} onClick={() => { onConfirm(); close(); }}>{confirmLabel}</Button></div></div></div>;
}
