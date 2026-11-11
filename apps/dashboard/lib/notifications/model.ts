// Admins read /admin/notifications, counselors /notifications; the bell shows both one way.

export type NotificationRow = {
  admin_notification_id?: string; notification_id?: string; category: string; title: string;
  context?: string | null; body?: string | null; target_path: string | null; read_at: string | null; created_at: string;
};
export type NotificationItem = { id: string; category: string; title: string; body: string | null; href: string | null; unread: boolean; createdAt: string };

// Admin alerts were written when the queue lived at /attention and /schedule (iteration 3)
const MOVED: Record<string, string> = { '/attention': '/monitoring', '/schedule': '/counseling' };

export function toItem(row: NotificationRow): NotificationItem {
  const id = row.admin_notification_id ?? row.notification_id ?? '';
  const href = row.target_path ? (row.admin_notification_id ? MOVED[row.target_path] ?? row.target_path : row.target_path) : null;
  return { id, category: row.category, title: row.title, body: row.context ?? row.body ?? null, href, unread: row.read_at === null, createdAt: row.created_at };
}

export function badgeText(unread: number) { return unread <= 0 ? '' : unread > 9 ? '9+' : String(unread); }

export function timeAgo(iso: string, now: number, language: 'id' | 'en') {
  const minutes = Math.floor((now - Date.parse(iso)) / 60_000);
  const id = language === 'id';
  if (minutes < 1) return id ? 'baru saja' : 'just now';
  if (minutes < 60) return id ? `${minutes} mnt lalu` : `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return id ? `${hours} jam lalu` : `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return id ? `${days} hari lalu` : `${days} d ago`;
  return new Intl.DateTimeFormat(id ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(iso));
}
