import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { ImagePlus, Pin, PlaySquare, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createAnnouncement, uploadAnnouncementImages } from '@/lib/announcements';
import type { Announcement } from '@/lib/types';

const YT_PATTERN = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/|v\/))[A-Za-z0-9_-]{11}/i;

export function AnnouncementComposer({
  classroomId, onCreated,
}: { classroomId: string; onCreated: (a: Announcement) => void }) {
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [ytUrl, setYtUrl] = useState('');
  const [youtubeUrls, setYoutubeUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  function reset() {
    setBody(''); setPinned(false); setFiles([]); setYtUrl(''); setYoutubeUrls([]);
    setError(null); setExpanded(false);
  }

  function addYt() {
    const v = ytUrl.trim();
    if (!v) return;
    if (!YT_PATTERN.test(v)) {
      setError('That does not look like a valid YouTube URL.');
      return;
    }
    setYoutubeUrls((arr) => [...arr, v]);
    setYtUrl('');
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true); setError(null);
    try {
      const created = await createAnnouncement(classroomId, {
        body: body.trim(),
        isPinned: pinned,
        youtubeUrls: youtubeUrls.length ? youtubeUrls : undefined,
      });
      let finalAnnouncement = created;
      if (files.length > 0) {
        const images = await uploadAnnouncementImages(created.id, files);
        finalAnnouncement = { ...created, attachments: [...created.attachments, ...images] };
      }
      onCreated(finalAnnouncement);
      reset();
    } catch (err) {
      setError(extractError(err) ?? 'Failed to post announcement');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onFocus={() => setExpanded(true)}
          placeholder="Share an update with your class…"
          rows={expanded ? 4 : 2}
          maxLength={10000}
          required
        />

        {expanded && (
          <>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex items-center gap-2 rounded-xl border border-white/70 bg-white/60 backdrop-blur-md px-3 py-2 text-sm cursor-pointer hover:bg-white/80">
                <ImagePlus className="h-4 w-4" />
                Add images
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
                />
              </label>
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="accent-brand" />
                <Pin className="h-4 w-4" /> Pin to top
              </label>
            </div>

            {files.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {files.length} image{files.length === 1 ? '' : 's'} selected
                <button type="button" onClick={() => setFiles([])} className="ml-2 text-brand hover:underline">clear</button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <PlaySquare className="h-4 w-4 text-muted-foreground" />
              <Input
                value={ytUrl}
                onChange={(e) => setYtUrl(e.target.value)}
                placeholder="Paste a YouTube URL"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addYt(); } }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addYt} disabled={!ytUrl.trim()}>
                Add
              </Button>
            </div>

            {youtubeUrls.length > 0 && (
              <ul className="flex flex-col gap-1">
                {youtubeUrls.map((u, i) => (
                  <li key={`${u}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-white/50 px-2 py-1 text-xs">
                    <span className="truncate">{u}</span>
                    <button type="button" onClick={() => setYoutubeUrls((arr) => arr.filter((_, j) => j !== i))} aria-label="Remove">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {error && <div className="text-sm text-destructive">{error}</div>}

        {expanded && (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={reset} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy || !body.trim()}>
              <Send className="h-4 w-4" /> {busy ? 'Posting…' : 'Post'}
            </Button>
          </div>
        )}
      </form>
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
