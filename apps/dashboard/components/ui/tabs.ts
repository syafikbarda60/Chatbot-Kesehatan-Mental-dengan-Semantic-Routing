import type { KeyboardEvent } from 'react';

export function handleTabListKeyDown(event: KeyboardEvent<HTMLElement>) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])'));
  const current = tabs.indexOf(document.activeElement as HTMLElement);
  if (current < 0 || tabs.length === 0) return;
  event.preventDefault();
  const target = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  tabs[target].focus();
  tabs[target].click();
}
