import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Bell, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { listNotifications, markAllRead, markRead } from '@/lib/notifications';
import type { NotificationItem } from '@/lib/types';
import { notificationIconFor, notificationTargetPath } from '@/components/notificationUtils';

export function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await listNotifications({ unread: filter === 'unread', limit: 100 }));
    } catch (err) {
      setError(extractError(err) ?? 'Failed to load notifications');
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function onClick(n: NotificationItem) {
    if (!n.readAt) {
      try {
        await markRead(n.id);
        setItems((arr) => (arr ? arr.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) : arr));
      } catch { /* ignore */ }
    }
    const path = notificationTargetPath(n);
    if (path) navigate(path);
  }

  async function onMarkAll() {
    setBusy(true);
    try {
      await markAllRead();
      setItems((arr) => (arr ? arr.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })) : arr));
    } catch (err) {
      setError(extractError(err) ?? 'Failed to mark all read');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-2xl bg-brand/15 text-brand grid place-items-center">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
            <p className="text-sm text-muted-foreground">Updates from your classes</p>
          </div>
        </div>
        <Button variant="outline" onClick={onMarkAll} disabled={busy}>
          <Check className="h-4 w-4" /> Mark all read
        </Button>
      </div>

      <div className="flex gap-2 border-b border-foreground/10">
        {(['all', 'unread'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              filter === f ? 'border-brand text-brand' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {f === 'all' ? 'All' : 'Unread'}
          </button>
        ))}
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
      {items === null && !error && <div className="text-sm text-muted-foreground">Loading…</div>}

      {items && items.length === 0 && (
        <Card className="text-center py-10">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-brand/15 text-brand grid place-items-center mb-3">
            <Bell className="h-6 w-6" />
          </div>
          <h3 className="font-semibold">
            {filter === 'unread' ? "You're all caught up." : 'No notifications yet.'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            New announcements and assignments will appear here.
          </p>
        </Card>
      )}

      {items && items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((n) => {
            const Icon = notificationIconFor(n.type);
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onClick(n)}
                  className={`w-full text-left rounded-2xl border px-4 py-3 transition-colors flex items-start gap-3 ${
                    n.readAt
                      ? 'border-white/60 bg-white/40 hover:bg-white/60'
                      : 'border-brand/30 bg-brand/5 hover:bg-brand/10'
                  }`}
                >
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-brand/15 text-brand grid place-items-center">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium truncate">{n.title}</div>
                      <div className="text-xs text-muted-foreground shrink-0">
                        {new Date(n.createdAt).toLocaleString()}
                      </div>
                    </div>
                    {n.body && <div className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>}
                    {n.classroom && (
                      <div className="text-xs text-muted-foreground mt-1">in {n.classroom.name}</div>
                    )}
                  </div>
                  {!n.readAt && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <Link to="/dashboard" className="text-sm text-brand hover:underline">Back to dashboard</Link>
      </div>
    </div>
  );
}

function extractError(err: unknown): string | null {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; message?: string } | undefined;
    return data?.error ?? data?.message ?? err.message;
  }
  return null;
}
