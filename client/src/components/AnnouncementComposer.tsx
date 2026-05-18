import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { FileText, ImagePlus, LinkIcon, Pin, PlaySquare, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  addLinkAttachment,
  createAnnouncement,
  uploadAnnouncementDocuments,
  uploadAnnouncementImages,
} from '@/lib/announcements';
import type { Announcement } from '@/lib/types';

const YT_PATTERN = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/|v\/))[A-Za-z0-9_-]{11}/i;
// Permissive: accepts http(s)://… or a bare host like drive.google.com/foo.
// The server's normalizeLink prepends https:// when missing and validates the URL.
const URL_PATTERN = /^(?:https?:\/\/)?[^\s.]+\.[^\s]+$/i;

interface PendingLink { url: string; title: string }

export function AnnouncementComposer({
  classroomId, onCreated,
}: { classroomId: string; onCreated: (a: Announcement) => void }) {
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [docs, setDocs] = useState<File[]>([]);
  const [ytUrl, setYtUrl] = useState('');
  const [youtubeUrls, setYoutubeUrls] = useState<string[]>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [links, setLinks] = useState<PendingLink[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  function reset() {
    setBody(''); setPinned(false); setFiles([]); setDocs([]);
    setYtUrl(''); setYoutubeUrls([]);
    setLinkUrl(''); setLinkTitle(''); setLinks([]);
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

  function addLink() {
    const url = linkUrl.trim();
    if (!url) return;
    if (!URL_PATTERN.test(url)) {
      setError('That link does not look valid.');
      return;
    }
    setLinks((arr) => [...arr, { url, title: linkTitle.trim() }]);
    setLinkUrl(''); setLinkTitle('');
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;

    // Flush any pending input the user typed but didn't explicitly add.
    const pendingLinks = [...links];
    const pendingYt = [...youtubeUrls];

    const trimmedLink = linkUrl.trim();
    if (trimmedLink) {
      if (!URL_PATTERN.test(trimmedLink)) {
        setError('That link does not look valid.');
        return;
      }
      pendingLinks.push({ url: trimmedLink, title: linkTitle.trim() });
    }

    const trimmedYt = ytUrl.trim();
    if (trimmedYt) {
      if (!YT_PATTERN.test(trimmedYt)) {
        setError('That does not look like a valid YouTube URL.');
        return;
      }
      pendingYt.push(trimmedYt);
    }

    setBusy(true); setError(null);
    try {
      const created = await createAnnouncement(classroomId, {
        body: body.trim(),
        isPinned: pinned,
        youtubeUrls: pendingYt.length ? pendingYt : undefined,
      });
      let finalAnnouncement = created;
      if (files.length > 0) {
        const images = await uploadAnnouncementImages(created.id, files);
        finalAnnouncement = { ...finalAnnouncement, attachments: [...finalAnnouncement.attachments, ...images] };
      }
      if (docs.length > 0) {
        const documents = await uploadAnnouncementDocuments(created.id, docs);
        finalAnnouncement = { ...finalAnnouncement, attachments: [...finalAnnouncement.attachments, ...documents] };
      }
      for (const l of pendingLinks) {
        const att = await addLinkAttachment(created.id, l.title ? { url: l.url, title: l.title } : { url: l.url });
        finalAnnouncement = { ...finalAnnouncement, attachments: [...finalAnnouncement.attachments, att] };
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
              <label className="inline-flex items-center gap-2 rounded-xl border border-white/70 bg-white/60 backdrop-blur-md px-3 py-2 text-sm cursor-pointer hover:bg-white/80">
                <FileText className="h-4 w-4" />
                Add documents
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => setDocs(e.target.files ? Array.from(e.target.files) : [])}
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

            {docs.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {docs.length} document{docs.length === 1 ? '' : 's'} selected
                <button type="button" onClick={() => setDocs([])} className="ml-2 text-brand hover:underline">clear</button>
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

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <LinkIcon className="h-4 w-4 text-muted-foreground hidden sm:block" />
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="Paste a link (Drive, OneDrive, article…)"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
              />
              <Input
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                placeholder="Title (optional)"
                className="sm:max-w-[12rem]"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addLink} disabled={!linkUrl.trim()}>
                Add
              </Button>
            </div>

            {links.length > 0 && (
              <ul className="flex flex-col gap-1">
                {links.map((l, i) => (
                  <li key={`${l.url}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-white/50 px-2 py-1 text-xs">
                    <span className="truncate">
                      {l.title ? <span className="font-medium">{l.title} · </span> : null}
                      {l.url}
                    </span>
                    <button type="button" onClick={() => setLinks((arr) => arr.filter((_, j) => j !== i))} aria-label="Remove">
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
