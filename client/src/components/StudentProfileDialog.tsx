import { useEffect, useState } from 'react';
import axios from 'axios';
import { FileText } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { resolveApiUrl } from '@/lib/api';
import { getClassroomStudentProfile } from '@/lib/profile';
import type { StudentDocumentInfo, User } from '@/lib/types';

interface Props {
  open: boolean;
  classroomId: string;
  studentId: string | null;
  onClose: () => void;
}

export function StudentProfileDialog({ open, classroomId, studentId, onClose }: Props) {
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !studentId) return;
    let cancelled = false;
    setProfile(null);
    setError(null);
    setLoading(true);
    (async () => {
      try {
        const u = await getClassroomStudentProfile(classroomId, studentId);
        if (!cancelled) setProfile(u);
      } catch (err) {
        if (!cancelled) setError(extractError(err) ?? 'Failed to load profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, classroomId, studentId]);

  const displayName = profile?.name ?? 'Student profile';
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={displayName}
      description={profile?.email ?? 'View student details'}
      className="max-w-lg"
    >
      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {error && <div className="text-sm text-destructive">{error}</div>}
      {!loading && !error && profile && (
        <div className="flex flex-col gap-4">
          <ProfileHeader user={profile} />
          <Section title="Identity">
            <Row label="Title" value={profile.title} />
            <Row label="First name" value={profile.firstName} />
            <Row label="Surname" value={profile.surname} />
          </Section>
          <Section title="Contact">
            <Row label="Email" value={profile.email} />
            <Row label="Phone" value={profile.phone} />
            <Row label="Country" value={profile.country} />
          </Section>
          <Section title="Professional">
            <Row label="Place of work" value={profile.placeOfWork} />
            <Row label="Position at WAPCP" value={profile.positionAtWapcp} />
          </Section>
          <Section title="Student record">
            <Row label="Registration number" value={profile.registrationNumber} />
            <Row
              label="Submission status"
              value={profile.profileSubmittedAt
                ? `Submitted on ${new Date(profile.profileSubmittedAt).toLocaleDateString()}`
                : 'Not submitted'}
            />
          </Section>
          <DocumentsSection documents={profile.documents} />
        </div>
      )}
    </Dialog>
  );
}

function DocumentsSection({ documents }: { documents: User['documents'] }) {
  return (
    <div className="rounded-xl bg-white/50 border border-white/60 px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Documents
      </div>
      <div className="flex flex-col gap-1.5">
        <DocRow label="Pharmacy degree certificate" info={documents.degreeCertificate} />
        <DocRow label="License to practice" info={documents.practiceLicense} />
        <DocRow label="Passport photograph" info={documents.passportPhoto} />
      </div>
    </div>
  );
}

function DocRow({ label, info }: { label: string; info: StudentDocumentInfo }) {
  const url = resolveApiUrl(info.url);
  return (
    <div className="flex items-center gap-2 text-sm">
      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="flex-1 min-w-0 truncate">{label}</span>
      {info.uploaded && url ? (
        <a href={url} target="_blank" rel="noreferrer"
          className="text-xs font-medium text-brand hover:underline">
          {info.originalName ? 'View' : 'View'}
        </a>
      ) : (
        <span className="text-xs text-muted-foreground/70 italic">Not uploaded</span>
      )}
    </div>
  );
}

function ProfileHeader({ user }: { user: User }) {
  const avatar = resolveApiUrl(user.avatarUrl);
  const initial = (user.name || user.firstName || user.email || '?').slice(0, 1).toUpperCase();
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
        <div className="font-semibold truncate">{user.name}</div>
        <div className="text-xs text-muted-foreground truncate">{user.email}</div>
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
      <dd className={value ? 'text-foreground' : 'text-muted-foreground/70 italic'}>
        {value || 'Not provided'}
      </dd>
    </>
  );
}

function extractError(err: unknown): string | null {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; message?: string } | undefined;
    return data?.error ?? data?.message ?? err.message;
  }
  return null;
}
