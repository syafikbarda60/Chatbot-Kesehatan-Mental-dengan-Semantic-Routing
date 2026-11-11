// The /realtime socket only ever says which area changed; pages refetch through the API.
export const TOPICS = ['signals', 'requests', 'schedule', 'notifications'] as const;
export type Topic = (typeof TOPICS)[number];
export type Notice = { kind: 'ready' } | { kind: 'changed'; topic: Topic };

export function readNotice(raw: string): Notice | null {
  let message: unknown;
  try { message = JSON.parse(raw); } catch { return null; }
  if (!message || typeof message !== 'object') return null;
  const { type, topic } = message as { type?: unknown; topic?: unknown };
  if (type === 'ready') return { kind: 'ready' };
  if (type === 'changed' && TOPICS.includes(topic as Topic)) return { kind: 'changed', topic: topic as Topic };
  return null;
}

export function reconnectDelay(attempt: number): number {
  return Math.min(30_000, 1_000 * 2 ** attempt);
}

// 4401/4403: the server refused the session itself, so retrying would only repeat the refusal
export function shouldReconnect(closeCode: number): boolean {
  return closeCode !== 4401 && closeCode !== 4403;
}
