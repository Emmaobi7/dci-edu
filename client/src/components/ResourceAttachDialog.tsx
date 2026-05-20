import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { FileUp, Link as LinkIcon, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  addResourceLink,
  addResourceYoutube,
  uploadResourceDocuments,
  type Resource,
  type ResourceAttachment,
} from '@/lib/resources';

interface Props {
  open: boolean;
  resource: Resource | null;
  onClose: () => void;
  onAdded: (attachments: ResourceAttachment[]) => void;
}

type Tab = 'file' | 'youtube' | 'link';

export function ResourceAttachDialog({ open, resource, onClose, onAdded }: Props) {
  const [tab, setTab] = useState<Tab>('file');
  const [ytUrl, setYtUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setTab('file'); setYtUrl(''); setLinkUrl(''); setLinkTitle(''); setError(null);
    }
  }, [open]);

  if (!resource) return null;

  function handleError(err: unknown, fallback: string) {
    if (axios.isAxiosError(err)) {
      setError(err.response?.data?.error ?? fallback);
    } else {
      setError(fallback);
    }
  }

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length === 0 || !resource) return;
    setBusy(true); setError(null);
    try {
      const attachments = await uploadResourceDocuments(resource.id, files);
      onAdded(attachments);
    } catch (err) {
      handleError(err, 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function onAddYoutube() {
    if (!ytUrl.trim() || !resource) return;
    setBusy(true); setError(null);
    try {
      const attachment = await addResourceYoutube(resource.id, ytUrl.trim());
      onAdded([attachment]);
      setYtUrl('');
    } catch (err) {
      handleError(err, 'Could not add YouTube link');
    } finally {
      setBusy(false);
    }
  }

  async function onAddLink() {
    if (!linkUrl.trim() || !resource) return;
    setBusy(true); setError(null);
    try {
      const attachment = await addResourceLink(resource.id, linkUrl.trim(), linkTitle.trim() || undefined);
      onAdded([attachment]);
      setLinkUrl(''); setLinkTitle('');
    } catch (err) {
      handleError(err, 'Could not add link');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Attach to "${resource.title}"`} className="max-w-lg">
      <div className="flex flex-col gap-4">
        <div className="flex gap-1.5 border-b border-foreground/10">
          <TabButton active={tab === 'file'} onClick={() => setTab('file')} icon={FileUp} label="Upload file" />
          <TabButton active={tab === 'youtube'} onClick={() => setTab('youtube')} icon={Video} label="YouTube" />
          <TabButton active={tab === 'link'} onClick={() => setTab('link')} icon={LinkIcon} label="Web link" />
        </div>

        {tab === 'file' && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">PDF, Word, PowerPoint, or Excel · up to 20 MB each.</p>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
              className="hidden"
              onChange={onPickFiles}
            />
            <Button type="button" onClick={() => fileRef.current?.click()} disabled={busy}>
              <FileUp className="h-4 w-4" /> {busy ? 'Uploading…' : 'Choose files'}
            </Button>
          </div>
        )}

        {tab === 'youtube' && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="yt-url">YouTube URL</Label>
            <Input id="yt-url" value={ytUrl} onChange={(e) => setYtUrl(e.target.value)} placeholder="https://youtu.be/…" />
            <Button type="button" onClick={onAddYoutube} disabled={busy || !ytUrl.trim()}>
              <Video className="h-4 w-4" /> {busy ? 'Adding…' : 'Add YouTube'}
            </Button>
          </div>
        )}

        {tab === 'link' && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="lnk-url">URL</Label>
            <Input id="lnk-url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://example.com/…" />
            <Label htmlFor="lnk-title">Title (optional)</Label>
            <Input id="lnk-title" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Display title" maxLength={200} />
            <Button type="button" onClick={onAddLink} disabled={busy || !linkUrl.trim()}>
              {busy ? 'Adding…' : 'Add link'}
            </Button>
          </div>
        )}

        {error && <div className="text-sm text-destructive">{error}</div>}

        <div className="flex justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>Done</Button>
        </div>
      </div>
    </Dialog>
  );
}

function TabButton({
  active, onClick, icon: Icon, label,
}: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ' +
        (active ? 'border-brand text-brand' : 'border-transparent text-muted-foreground hover:text-foreground')
      }
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
