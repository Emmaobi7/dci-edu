import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  listNotifications, markAllRead, markRead, unreadCount,
} from '@/lib/notifications';
import { notificationTargetPath, notificationIconFor } from './notificationUtils';
import type { NotificationItem } from '@/lib/types';

const POLL_MS = 30000;
const DROPDOWN_LIMIT = 10;

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    try { setCount(await unreadCount()); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    refreshCount();
    const id = window.setInterval(refreshCount, POLL_MS);
    return () => window.clearInterval(id);
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      try {
        setItems(await listNotifications({ limit: DROPDOWN_LIMIT }));
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
  }

  async function onItemClick(n: NotificationItem) {
    setOpen(false);
    if (!n.readAt) {
      try {
        await markRead(n.id);
        setItems((arr) => (arr ? arr.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) : arr));
        setCount((c) => Math.max(0, c - 1));
      } catch { /* ignore */ }
    }
    const path = notificationTargetPath(n);
    if (path) navigate(path);
  }

  async function onMarkAll() {
    try {
      await markAllRead();
      setItems((arr) => (arr ? arr.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })) : arr));
      setCount(0);
    } catch { /* ignore */ }
  }

  return (
    <div className="relative" ref={rootRef}>
      <Button variant="outline" size="icon" onClick={toggle} aria-label="Notifications" className="relative">
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white shadow">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </Button>

      {open && (
        <div className="glass-strong absolute right-0 mt-2 w-80 max-w-[calc(100vw-1rem)] rounded-2xl p-2 z-30 shadow-glass-lg">
          <div className="flex items-center justify-between px-2 py-1">
            <div className="text-sm font-semibold">Notifications</div>
            <button type="button" onClick={onMarkAll} className="text-xs text-brand hover:underline inline-flex items-center gap-1">
              <Check className="h-3 w-3" /> Mark all read
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading && <div className="px-3 py-4 text-xs text-muted-foreground">Loading…</div>}
            {!loading && items && items.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">You're all caught up.</div>
            )}
            {!loading && items && items.length > 0 && (
              <ul className="flex flex-col">
                {items.map((n) => {
                  const Icon = notificationIconFor(n.type);
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => onItemClick(n)}
                        className={`flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-white/60 ${n.readAt ? 'opacity-70' : ''}`}
                      >
                        <div className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-brand/15 text-brand grid place-items-center">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{n.title}</div>
                          {n.body && <div className="text-[11px] text-muted-foreground line-clamp-2">{n.body}</div>}
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {n.classroom?.name ?? ''} {n.classroom ? '· ' : ''}
                            {new Date(n.createdAt).toLocaleString()}
                          </div>
                        </div>
                        {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="border-t border-white/60 mt-1 pt-1">
            <button
              type="button"
              onClick={() => { setOpen(false); navigate('/notifications'); }}
              className="block w-full rounded-xl px-3 py-2 text-center text-xs font-medium text-brand hover:bg-white/60"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
