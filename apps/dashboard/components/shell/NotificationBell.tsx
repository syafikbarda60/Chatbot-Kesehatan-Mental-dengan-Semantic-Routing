'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Icon } from '@/components/ui';
import { apiRequest } from '@/lib/api/client';
import { badgeText, timeAgo, toItem, type NotificationItem, type NotificationRow } from '@/lib/notifications/model';
import { useLiveRefresh } from '@/lib/realtime/useLiveRefresh';

const COPY = {
  id: { title: 'Notifikasi', unread: '{n} belum dibaca', markAll: 'Tandai semua dibaca', empty: 'Belum ada notifikasi.', error: 'Notifikasi belum bisa dimuat.' },
  en: { title: 'Notifications', unread: '{n} unread', markAll: 'Mark all as read', empty: 'No notifications yet.', error: 'Notifications could not be loaded.' },
};

/** Admins read their alert queue, counselors their own notifications; both refresh live. */
export function NotificationBell() {
  const router = useRouter(); const { user } = useAuth(); const { language } = useLanguage(); const copy = COPY[language];
  const base = user?.role === 'admin' ? '/admin/notifications' : '/notifications';
  const [items, setItems] = useState<NotificationItem[]>([]); const [unread, setUnread] = useState(0);
  const [failed, setFailed] = useState(false); const [open, setOpen] = useState(false);
  // Read when the panel opens, so "5 mnt lalu" is true for as long as it stays open
  const [now, setNow] = useState(0);
  const wrapper = useRef<HTMLDivElement>(null); const trigger = useRef<HTMLButtonElement>(null);

  const load = useCallback(() => {
    apiRequest<{ notifications: NotificationRow[]; unread: number }>(`${base}?page_size=20`)
      .then((result) => { setItems(result.notifications.map(toItem)); setUnread(result.unread); setFailed(false); })
      .catch(() => setFailed(true));
  }, [base]);
  useEffect(load, [load]);
  useLiveRefresh(load, { topics: ['notifications'] });

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!wrapper.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);

  // Optimistic: the list reads as handled at once; the next refresh corrects a failed write
  const markRead = (item: NotificationItem) => {
    if (item.unread) {
      setItems((list) => list.map((x) => x.id === item.id ? { ...x, unread: false } : x)); setUnread((n) => Math.max(0, n - 1));
      apiRequest(`${base}/${encodeURIComponent(item.id)}/read`, { method: 'PATCH' }).catch(load);
    }
    setOpen(false);
    if (item.href) router.push(item.href);
  };
  const markAll = () => {
    setItems((list) => list.map((x) => ({ ...x, unread: false }))); setUnread(0);
    apiRequest(`${base}/mark-all-read`, { method: 'POST' }).catch(load);
  };

  const badge = badgeText(unread);
  const label = unread ? `${copy.title}, ${copy.unread.replace('{n}', String(unread))}` : copy.title;
  return <div className="notification-bell" ref={wrapper}>
    <button ref={trigger} className="icon-button" aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setNow(Date.now()); setOpen((value) => !value); }}>
      <Icon name="bell" />{badge && <span className="notification-badge" aria-hidden="true">{badge}</span>}
    </button>
    {open && <section className="notification-panel" role="dialog" aria-label={copy.title}>
      <header><div><h2>{copy.title}</h2>{unread > 0 && <small>{copy.unread.replace('{n}', String(unread))}</small>}</div>
        {unread > 0 && <button className="text-link-button" onClick={markAll}>{copy.markAll}</button>}</header>
      {failed && !items.length ? <p className="notification-empty">{copy.error}</p> : !items.length ? <p className="notification-empty">{copy.empty}</p> :
        <ul>{items.map((item) => <li key={item.id}>
          <button className={item.unread ? 'notification-item unread' : 'notification-item'} onClick={() => markRead(item)}>
            <span className={`notification-dot notification-${item.category}`} aria-hidden="true" />
            <span className="notification-text"><strong>{item.title}</strong>{item.body && <span>{item.body}</span>}<small>{timeAgo(item.createdAt, now, language)}</small></span>
          </button>
        </li>)}</ul>}
    </section>}
  </div>;
}
