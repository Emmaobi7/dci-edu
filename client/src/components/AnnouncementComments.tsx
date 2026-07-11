import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { MessageCircle, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { createComment, deleteComment } from '@/lib/announcements';
import type { AnnouncementComment } from '@/lib/types';

interface Props {
  announcementId: string;
  comments: AnnouncementComment[];
  currentUserId: string;
  canModerate: boolean;
  onChange: (comments: AnnouncementComment[]) => void;
}

export function AnnouncementComments({
  announcementId, comments, currentUserId, canModerate, onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true); setError(null);
    try {
      const created = await createComment(announcementId, body.trim());
      onChange([...comments, created]);
      setBody('');
    } catch (err) {
      setError(extractError(err) ?? 'Failed to post comment');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteComment(id);
      onChange(comments.filter((c) => c.id !== id));
    } catch (err) {
      setError(extractError(err) ?? 'Failed to delete comment');
    }
  }

  return (
    <div className="border-t border-foreground/10 pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <MessageCircle className="h-4 w-4" />
        {comments.length === 0
          ? 'Add a comment'
          : `${comments.length} comment${comments.length === 1 ? '' : 's'}`}
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          {comments.length > 0 && (
            <ul className="flex flex-col gap-2">
              {comments.map((c) => (
                <li key={c.id} className="flex items-start gap-2.5">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-brand/15 text-brand grid place-items-center text-xs font-medium">
                    {c.author.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 rounded-xl bg-[#fbbf24]/10 backdrop-blur-md border border-[#fbbf24]/20 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-medium">{c.author.name}</div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{new Date(c.createdAt).toLocaleString()}</span>
                        {(c.authorId === currentUserId || canModerate) && (
                          <button
                            type="button"
                            onClick={() => onDelete(c.id)}
                            aria-label="Delete comment"
                            className="hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap break-words">{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={onSubmit} className="flex items-start gap-2">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write a comment…"
              maxLength={2000}
              rows={2}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={busy || !body.trim()} aria-label="Post comment">
              <Send className="h-4 w-4" />
            </Button>
          </form>
          {error && <div className="text-xs text-destructive">{error}</div>}
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
