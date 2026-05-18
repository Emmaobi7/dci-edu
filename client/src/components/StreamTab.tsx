import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { listAnnouncements } from '@/lib/announcements';
import type { Announcement, Role } from '@/lib/types';
import { AnnouncementCard } from './AnnouncementCard';
import { AnnouncementComposer } from './AnnouncementComposer';

const PAGE_SIZE = 10;

interface Props {
  classroomId: string;
  viewerId: string;
  viewerRole: Role | undefined;
  isOwner: boolean;
}

export function StreamTab({ classroomId, viewerId, viewerRole, isOwner }: Props) {
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCompose = isOwner || viewerRole === 'TEACHER' || viewerRole === 'ADMIN';
  const canModerate = isOwner; // pin / delete others' announcements

  const loadFirst = useCallback(async () => {
    setError(null);
    try {
      const { announcements, hasMore } = await listAnnouncements(classroomId, {
        take: PAGE_SIZE,
        skip: 0,
      });
      setItems(announcements);
      setHasMore(hasMore);
    } catch (err) {
      setError(extractError(err) ?? 'Failed to load stream');
    }
  }, [classroomId]);

  useEffect(() => { loadFirst(); }, [loadFirst]);

  async function loadMore() {
    if (!items || loadingMore) return;
    setLoadingMore(true); setError(null);
    try {
      const { announcements, hasMore } = await listAnnouncements(classroomId, {
        take: PAGE_SIZE,
        skip: items.length,
      });
      // Filter out any items the page might re-include (e.g. brand-new posts
      // appearing while paginating) so we don't show duplicates.
      const existingIds = new Set(items.map((a) => a.id));
      const fresh = announcements.filter((a) => !existingIds.has(a.id));
      setItems([...items, ...fresh]);
      setHasMore(hasMore);
    } catch (err) {
      setError(extractError(err) ?? 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  }

  function onCreated(a: Announcement) {
    // New post goes to top of feed (pinned items still come first naturally
    // because the server returns them on subsequent loads).
    setItems((prev) => (prev ? [a, ...prev] : [a]));
  }

  function onAnnouncementChange(updated: Announcement) {
    setItems((prev) => (prev ? prev.map((x) => (x.id === updated.id ? updated : x)) : prev));
  }

  function onAnnouncementDelete(id: string) {
    setItems((prev) => (prev ? prev.filter((x) => x.id !== id) : prev));
  }

  return (
    <div className="flex flex-col gap-4">
      {canCompose && (
        <AnnouncementComposer classroomId={classroomId} onCreated={onCreated} />
      )}

      {error && <div className="text-sm text-destructive">{error}</div>}
      {items === null && !error && <div className="text-sm text-muted-foreground">Loading stream…</div>}

      {items && items.length === 0 && (
        <Card className="text-center py-10">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-brand/15 text-brand grid place-items-center mb-3">
            <Megaphone className="h-6 w-6" />
          </div>
          <h3 className="font-semibold">No announcements yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {canCompose
              ? 'Share an update so your class can see it.'
              : 'Your faculty has not posted any updates yet.'}
          </p>
        </Card>
      )}

      {items && items.length > 0 && (
        <div className="flex flex-col gap-3">
          {items.map((a) => (
            <AnnouncementCard
              key={a.id}
              announcement={a}
              currentUserId={viewerId}
              canModerate={canModerate}
              onChange={onAnnouncementChange}
              onDelete={onAnnouncementDelete}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
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
