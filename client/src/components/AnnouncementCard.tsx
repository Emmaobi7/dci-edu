import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { Megaphone, Pencil, Pin, PinOff, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { deleteAnnouncement, updateAnnouncement } from '@/lib/announcements';
import type { Announcement, AnnouncementComment } from '@/lib/types';
import { AnnouncementMedia } from './AnnouncementMedia';
import { AnnouncementComments } from './AnnouncementComments';

interface Props {
  announcement: Announcement;
  currentUserId: string;
  canModerate: boolean;
  onChange: (a: Announcement) => void;
  onDelete: (id: string) => void;
}

export function AnnouncementCard({ announcement, currentUserId, canModerate, onChange, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(announcement.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthor = announcement.authorId === currentUserId;
  const canEdit = isAuthor || canModerate;

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true); setError(null);
    try {
      const updated = await updateAnnouncement(announcement.id, { body: body.trim() });
      onChange(updated);
      setEditing(false);
    } catch (err) {
      setError(extractError(err) ?? 'Failed to save changes');
    } finally {
      setBusy(false);
    }
  }

  async function togglePin() {
    setBusy(true); setError(null);
    try {
      const updated = await updateAnnouncement(announcement.id, { isPinned: !announcement.isPinned });
      onChange(updated);
    } catch (err) {
      setError(extractError(err) ?? 'Failed to pin');
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteClick() {
    if (!window.confirm('Delete this announcement? This cannot be undone.')) return;
    setBusy(true); setError(null);
    try {
      await deleteAnnouncement(announcement.id);
      onDelete(announcement.id);
    } catch (err) {
      setError(extractError(err) ?? 'Failed to delete');
      setBusy(false);
    }
  }

  function onCommentsChange(comments: AnnouncementComment[]) {
    onChange({ ...announcement, comments });
  }

  return (
    <Card className={announcement.isPinned ? 'ring-2 ring-brand/40' : undefined}>
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-brand/15 text-brand grid place-items-center shrink-0">
          <Megaphone className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{announcement.author.name}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(announcement.createdAt).toLocaleString()}
                {announcement.updatedAt !== announcement.createdAt && (
                  <span className="ml-1">· edited</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {announcement.isPinned && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-medium text-brand">
                  <Pin className="h-3 w-3" /> Pinned
                </span>
              )}
              {canEdit && !editing && (
                <>
                  {canModerate && (
                    <Button size="icon" variant="ghost" onClick={togglePin} disabled={busy} aria-label={announcement.isPinned ? 'Unpin' : 'Pin'}>
                      {announcement.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => setEditing(true)} aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={onDeleteClick} disabled={busy} aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
              {editing && (
                <Button size="icon" variant="ghost" onClick={() => { setEditing(false); setBody(announcement.body); }} aria-label="Cancel">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {editing ? (
            <form onSubmit={onSaveEdit} className="mt-3 flex flex-col gap-2">
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={10000} required />
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={busy || !body.trim()}>
                  {busy ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </form>
          ) : (
            <p className="mt-3 text-sm whitespace-pre-wrap break-words">{announcement.body}</p>
          )}

          {announcement.attachments.length > 0 && (
            <div className="mt-3">
              <AnnouncementMedia attachments={announcement.attachments} />
            </div>
          )}

          {error && <div className="mt-2 text-xs text-destructive">{error}</div>}

          <div className="mt-3">
            <AnnouncementComments
              announcementId={announcement.id}
              comments={announcement.comments}
              currentUserId={currentUserId}
              canModerate={canModerate}
              onChange={onCommentsChange}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

function extractError(err: unknown): string | null {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; message?: string } | undefined;
    return data?.error ?? data?.message ?? err.message;
  }
  return null;
}
