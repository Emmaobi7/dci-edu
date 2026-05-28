import { useEffect, useState } from 'react';
import axios from 'axios';
import { Dialog } from '@/components/ui/dialog';
import { resolveApiUrl } from '@/lib/api';
import { getFacultyBio, type FacultyBio } from '@/lib/users';

interface Props {
  open: boolean;
  facultyId: string | null;
  onClose: () => void;
}

export function FacultyBioDialog({ open, facultyId, onClose }: Props) {
  const [bio, setBio] = useState<FacultyBio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !facultyId) return;
    let cancelled = false;
    setBio(null);
    setError(null);
    setLoading(true);
    (async () => {
      try {
        const b = await getFacultyBio(facultyId);
        if (!cancelled) setBio(b);
      } catch (err) {
        if (!cancelled) setError(extractError(err) ?? 'Failed to load faculty bio');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, facultyId]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={bio?.name ?? 'Faculty'}
      description={bio?.title ? bio.title : 'Faculty profile'}
      className="max-w-lg"
    >
      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {error && <div className="text-sm text-destructive">{error}</div>}
      {!loading && !error && bio && (
        <div className="flex flex-col gap-4">
          <Header bio={bio} />
          <Section title="Profile">
            <Row label="Title" value={bio.title} />
            <Row label="Country" value={bio.country} />
            <Row label="Place of work" value={bio.placeOfWork} />
            <Row label="Position at WAPCP" value={bio.positionAtWapcp} />
          </Section>
          <Section title="Teaching">
            <Row label="Topics" value={bio.topics} />
          </Section>
        </div>
      )}
    </Dialog>
  );
}

function Header({ bio }: { bio: FacultyBio }) {
  const avatar = resolveApiUrl(bio.avatarUrl);
  const initial = (bio.name || '?').slice(0, 1).toUpperCase();
  return (
    <div className="flex items-center gap-3">
      {avatar ? (
        <img src={avatar} alt="" className="h-14 w-14 rounded-2xl object-cover ring-2 ring-white shadow-glass-lg" />
      ) : (
        <div className="h-14 w-14 rounded-2xl bg-brand/15 text-brand grid place-items-center text-xl font-semibold ring-2 ring-white shadow-glass-lg">
          {initial}
        </div>
      )}
      <div className="min-w-0">
        <div className="font-semibold truncate">{bio.name}</div>
        {bio.title && <div className="text-xs text-muted-foreground truncate">{bio.title}</div>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/50 border border-white/60 px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{title}</div>
      <dl className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-x-3 gap-y-1.5 text-sm">{children}</dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={value ? 'text-foreground whitespace-pre-wrap' : 'text-muted-foreground/70 italic'}>
        {value || 'Not provided'}
      </dd>
    </>
  );
}

function extractError(err: unknown): string | null {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error ?? err.message ?? null;
  }
  return null;
}
