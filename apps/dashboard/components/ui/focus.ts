'use client';

import { useEffect, type RefObject } from 'react';

const focusable = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useModalFocus(open: boolean, container: RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = container.current;
    const first = node?.querySelector<HTMLElement>(focusable);
    window.requestAnimationFrame(() => first?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      const modalStack = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]'));
      const topmostModal = modalStack[modalStack.length - 1];
      if (topmostModal && topmostModal !== node) return;
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab' || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(focusable)).filter((item) => item.offsetParent !== null);
      if (!items.length) { event.preventDefault(); return; }
      const firstItem = items[0]; const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) { event.preventDefault(); lastItem.focus(); }
      else if (!event.shiftKey && document.activeElement === lastItem) { event.preventDefault(); firstItem.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus(); };
  }, [open, container, close]);
}
