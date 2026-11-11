'use client';

import { useEffect, useRef } from 'react';
import { apiBaseUrl } from '@/lib/api/client';
import { readSession } from '@/lib/auth/session';
import { isPreviewMode } from '@/lib/previewMode';
import { readNotice, reconnectDelay, shouldReconnect, type Topic } from '@/lib/realtime/notice';

type Listener = (event: Topic | 'resync') => void;

// One socket per tab, shared by every mounted page that listens, closed when the last one leaves.
const listeners = new Set<Listener>();
let socket: WebSocket | null = null;
let ready = false;
let attempt = 0;
let retryTimer: number | undefined;

function emit(event: Topic | 'resync') { listeners.forEach((listener) => listener(event)); }

function connect() {
  window.clearTimeout(retryTimer);
  const token = readSession()?.accessToken;
  if (socket || !token || isPreviewMode() || listeners.size === 0) return;
  const ws = new WebSocket(`${apiBaseUrl().replace(/^http/, 'ws')}/realtime`);
  socket = ws;
  // The token goes in the first message, never the URL, so it stays out of server logs.
  ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token }));
  ws.onmessage = (message) => {
    const notice = typeof message.data === 'string' ? readNotice(message.data) : null;
    if (notice?.kind === 'ready') {
      ready = true;
      // Changes made while the socket was down were never announced: catch up once.
      if (attempt > 0) emit('resync');
      attempt = 0;
    } else if (notice?.kind === 'changed') {
      emit(notice.topic);
    }
  };
  ws.onclose = (event) => {
    if (socket === ws) socket = null;
    ready = false;
    if (listeners.size > 0 && shouldReconnect(event.code)) retryTimer = window.setTimeout(connect, reconnectDelay(attempt++));
  };
}

function disconnectWhenUnused() {
  if (listeners.size > 0) return;
  window.clearTimeout(retryTimer);
  socket?.close(1000);
  socket = null;
  ready = false;
  attempt = 0;
}

/**
 * Keeps a page's data fresh without a full reload. `refresh` must refetch silently: keep what is
 * on screen, no skeleton, no reset of filters or selection.
 * - `topics`: pages where seconds matter hear about changes over the shared socket. While the
 *   socket is down they fall back to polling, so a refused or broken socket only slows them down.
 * - no topics: the page polls every `pollMs` while the tab is visible.
 * Either way the page catches up when the tab becomes visible again. `null` turns it all off.
 */
export function useLiveRefresh(refresh: () => void, options: { topics?: readonly Topic[]; pollMs?: number } | null = {}) {
  const enabled = options !== null;
  const { topics = [], pollMs = 60_000 } = options ?? {};
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  const topicKey = topics.join(',');

  useEffect(() => {
    if (!enabled) return;
    const wanted = new Set(topicKey ? topicKey.split(',') : []);
    let debounce: number | undefined;
    // A burst of writes (one booking touches several tables) becomes one refetch.
    const trigger = () => { window.clearTimeout(debounce); debounce = window.setTimeout(() => refreshRef.current(), 800); };
    const listener: Listener = (event) => { if (event === 'resync' || wanted.has(event)) trigger(); };
    if (wanted.size > 0) { listeners.add(listener); connect(); }
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !(wanted.size > 0 && ready)) trigger();
    }, pollMs);
    const onVisible = () => { if (document.visibilityState === 'visible') trigger(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(debounce);
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      listeners.delete(listener);
      disconnectWhenUnused();
    };
  }, [enabled, topicKey, pollMs]);
}
