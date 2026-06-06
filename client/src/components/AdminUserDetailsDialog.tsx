import { useEffect, useState } from 'react';
import axios from 'axios';
import { FileText, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { resolveApiUrl } from '@/lib/api';
import { roleLabel } from '@/lib/utils';
import { reopenStudentProfile, updateUserClearance, type AdminUser } from '@/lib/users';
import type { Clearance, StudentDocumentInfo } from '@/lib/types';

interface Props {
  user: AdminUser | null;
  onClose: () => void;
  onUpdated?: (user: AdminUser) => void;
}

export function AdminUserDetailsDialog({ user, onClose, onUpdated }: Props) {
  const open = !!user;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={user?.name ?? 'User details'}
      description={user?.email ?? ''}
      className="max-w-lg"
    >
      {user && (
        <div className="flex flex-col gap-4">
          <Header user={user} />
          <Section title="Identity">
            <Row label="Title" value={user.title} />
            {user.role === 'STUDENT' ? (
              <>
                <Row label="First name" value={user.firstName} />
                <Row label="Surname" value={user.surname} />
              </>
            ) : (
              <Row label="Name" value={user.name} />
            )}
            <Row label="Role" value={roleLabel(user.role)} />
          </Section>
          <Section title="Contact">
            <Row label="Email" value={user.email} />
            <Row label="Phone" value={user.phone} />
            <Row label="Country" value={user.country} />
          </Section>
          {user.role === 'STUDENT' && (
            <>
              <Section title="Professional">
                <Row label="Place of work" value={user.placeOfWork} />
                <Row label="Position at WAPCP" value={user.positionAtWapcp} />
              </Section>
              <Section title="Student record">
                <Row label="Registration number" value={user.registrationNumber} />
                <Row
                  label="Submission status"
                  value={user.profileSubmittedAt
                    ? `Submitted on ${new Date(user.profileSubmittedAt).toLocaleDateString()}`
                    : 'Not submitted'}
                />
                {user.profileSubmittedAt && (
                  <ReopenProfileControl user={user} onUpdated={onUpdated} />
                )}
              </Section>
              <DocumentsSection documents={user.documents} />
              <ClearanceSection user={user} onUpdated={onUpdated} />
            </>
          )}
          {user.role === 'TEACHER' && (
            <Section title="Teaching">
              <Row label="Topics" value={user.topics} />
            </Section>
          )}
        </div>
      )}
    </Dialog>
  );
}

function ClearanceSection({ user, onUpdated }: { user: AdminUser; onUpdated?: (u: AdminUser) => void }) {
  const [status, setStatus] = useState<Clearance>(user.clearance);
  const [remark, setRemark] = useState(user.clearanceRemark ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    setStatus(user.clearance);
    setRemark(user.clearanceRemark ?? '');
    setError(null);
    setSavedAt(null);
  }, [user.id, user.clearance, user.clearanceRemark]);

  const dirty = status !== user.clearance || (remark.trim() || '') !== (user.clearanceRemark ?? '');

  async function onSave() {
    setSaving(true); setError(null);
    try {
      const updated = await updateUserClearance(user.id, status, remark.trim() || null);
      onUpdated?.(updated);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.error ?? 'Could not update clearance');
      else setError('Could not update clearance');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl bg-white/50 border border-white/60 px-3 py-2 flex flex-col gap-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Clearance</div>
      <div className="flex flex-wrap gap-2">
        {(['NOT_CLEARED', 'CLEARED'] as Clearance[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setStatus(c)}
            className={
              'rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ' +
              (status === c
                ? c === 'CLEARED'
                  ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-700 border-rose-500/30'
                : 'bg-white/60 border-white/70 hover:bg-white/80')
            }
          >
            {c === 'CLEARED' ? 'Cleared' : 'Not cleared'}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="clearance-remark" className="text-xs">Remark (optional)</Label>
        <Textarea
          id="clearance-remark"
          rows={2}
          maxLength={1000}
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder="Notes visible to the student on their profile"
        />
      </div>
      {user.clearanceUpdatedAt && (
        <div className="text-[11px] text-muted-foreground">
          Last updated {new Date(user.clearanceUpdatedAt).toLocaleString()}
        </div>
      )}
      {error && <div className="text-xs text-destructive">{error}</div>}
      {savedAt && !error && <div className="text-xs text-emerald-700">Saved at {savedAt}</div>}
      <div className="flex justify-end">
        <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save clearance'}
        </Button>
      </div>
    </div>
  );
}

function ReopenProfileControl({ user, onUpdated }: { user: AdminUser; onUpdated?: (u: AdminUser) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setConfirming(false);
    setError(null);
  }, [user.id]);

  async function onConfirm() {
    setSaving(true); setError(null);
    try {
      const updated = await reopenStudentProfile(user.id);
      onUpdated?.(updated);
      setConfirming(false);
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.error ?? 'Could not reopen profile');
      else setError('Could not reopen profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 flex flex-col gap-2">
      <div className="text-xs text-amber-900">
        Reopening will unlock the student's profile so they can edit their details and replace
        documents. Their existing data is kept.
      </div>
      {error && <div className="text-xs text-destructive">{error}</div>}
      <div className="flex justify-end gap-2">
        {confirming ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={onConfirm} disabled={saving}>
              {saving ? 'Reopening…' : 'Confirm reopen'}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
            <Unlock className="h-3.5 w-3.5 mr-1" /> Reopen profile
          </Button>
        )}
      </div>
    </div>
  );
}

function Header({ user }: { user: AdminUser }) {
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

function DocumentsSection({ documents }: { documents: AdminUser['documents'] }) {
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
          {info.originalName ? 'Download' : 'View'}
        </a>
      ) : (
        <span className="text-xs text-muted-foreground/70 italic">Not uploaded</span>
      )}
    </div>
  );
}
