import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import axios from 'axios';
import {
  UserCircle2, Phone, Globe2, Briefcase, GraduationCap, Mail, BookOpen,
  Camera, Trash2, FileText, Image as ImageIcon, FileBadge2, CheckCircle2,
  Lock, Send, Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { resolveApiUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  deleteAvatar, deleteStudentDocument, getMyProfile, submitMyProfile,
  updateMyProfile, uploadAvatar, uploadStudentDocument,
} from '@/lib/profile';
import type {
  ProfileUpdate, Role, StudentDocumentInfo, StudentDocumentKind, User,
} from '@/lib/types';

const TITLES = ['', 'Dr', 'Prof', 'Mr', 'Mrs', 'Ms', 'Miss'] as const;

type Form = {
  title: string;
  name: string;
  firstName: string;
  surname: string;
  phone: string;
  country: string;
  placeOfWork: string;
  positionAtWapcp: string;
  registrationNumber: string;
  topics: string;
};

function toForm(u: User | null): Form {
  return {
    title: u?.title ?? '',
    name: u?.name ?? '',
    firstName: u?.firstName ?? '',
    surname: u?.surname ?? '',
    phone: u?.phone ?? '',
    country: u?.country ?? '',
    placeOfWork: u?.placeOfWork ?? '',
    positionAtWapcp: u?.positionAtWapcp ?? '',
    registrationNumber: u?.registrationNumber ?? '',
    topics: u?.topics ?? '',
  };
}

function diff(form: Form, base: Form, role: Role | undefined): ProfileUpdate {
  const out: ProfileUpdate = {};
  const allowed = new Set<keyof Form>(
    role === 'STUDENT'
      ? ['title', 'firstName', 'surname', 'phone', 'country', 'placeOfWork', 'positionAtWapcp', 'registrationNumber']
      : ['title', 'name', 'phone', 'country', 'topics'],
  );
  (Object.keys(form) as Array<keyof Form>).forEach((k) => {
    if (allowed.has(k) && form[k] !== base[k]) out[k] = form[k];
  });
  return out;
}

const EMPTY_DOC: StudentDocumentInfo = { uploaded: false, originalName: null, url: null };
const EMPTY_DOCS = {
  degreeCertificate: EMPTY_DOC,
  practiceLicense: EMPTY_DOC,
  passportPhoto: EMPTY_DOC,
} as const;

export function ProfilePage() {
  const { user, refresh } = useAuth();
  const [base, setBase] = useState<Form>(() => toForm(user));
  const [form, setForm] = useState<Form>(() => toForm(user));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(user?.profileSubmittedAt ?? null);
  const [documents, setDocuments] = useState(user?.documents ?? EMPTY_DOCS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [docBusy, setDocBusy] = useState<Partial<Record<StudentDocumentKind, boolean>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const docRefs: Record<StudentDocumentKind, React.RefObject<HTMLInputElement | null>> = {
    'degree-certificate': useRef<HTMLInputElement>(null),
    'practice-license': useRef<HTMLInputElement>(null),
    'passport-photo': useRef<HTMLInputElement>(null),
  };

  function applyUser(u: User) {
    const next = toForm(u);
    setBase(next);
    setForm(next);
    setAvatarUrl(u.avatarUrl);
    setSubmittedAt(u.profileSubmittedAt);
    setDocuments(u.documents);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const u = await getMyProfile();
        if (cancelled) return;
        applyUser(u);
      } catch (err) {
        if (!cancelled) setError(extractError(err) ?? 'Failed to load profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const role = user?.role;
  const locked = role === 'STUDENT' && submittedAt != null;
  const canEdit = (role === 'STUDENT' || role === 'TEACHER') && !locked;
  const dirty = useMemo(() => Object.keys(diff(form, base, role)).length > 0, [form, base, role]);

  function set<K extends keyof Form>(key: K, value: string) {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || !dirty) return;
    setError(null);
    setSaving(true);
    try {
      const updated = await updateMyProfile(diff(form, base, role));
      applyUser(updated);
      setSaved(true);
      await refresh();
    } catch (err) {
      setError(extractError(err) ?? 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setAvatarBusy(true);
    try {
      const updated = await uploadAvatar(file);
      applyUser(updated);
      await refresh();
    } catch (err) {
      setError(extractError(err) ?? 'Failed to upload photo');
    } finally {
      setAvatarBusy(false);
    }
  }

  async function onRemoveAvatar() {
    if (!avatarUrl) return;
    setError(null);
    setAvatarBusy(true);
    try {
      const updated = await deleteAvatar();
      applyUser(updated);
      await refresh();
    } catch (err) {
      setError(extractError(err) ?? 'Failed to remove photo');
    } finally {
      setAvatarBusy(false);
    }
  }

  async function onPickDoc(kind: StudentDocumentKind, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setDocBusy((b) => ({ ...b, [kind]: true }));
    try {
      const updated = await uploadStudentDocument(kind, file);
      applyUser(updated);
      await refresh();
    } catch (err) {
      setError(extractError(err) ?? 'Failed to upload document');
    } finally {
      setDocBusy((b) => ({ ...b, [kind]: false }));
    }
  }

  async function onRemoveDoc(kind: StudentDocumentKind) {
    setError(null);
    setDocBusy((b) => ({ ...b, [kind]: true }));
    try {
      const updated = await deleteStudentDocument(kind);
      applyUser(updated);
      await refresh();
    } catch (err) {
      setError(extractError(err) ?? 'Failed to remove document');
    } finally {
      setDocBusy((b) => ({ ...b, [kind]: false }));
    }
  }

  async function onSubmitProfile() {
    if (locked || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const updated = await submitMyProfile();
      applyUser(updated);
      await refresh();
    } catch (err) {
      setError(extractError(err) ?? 'Failed to submit profile');
    } finally {
      setSubmitting(false);
    }
  }

  const initial = (form.name || form.firstName || user?.email || '?').slice(0, 1).toUpperCase();
  const resolvedAvatar = resolveApiUrl(avatarUrl);
  const submittedDate = submittedAt ? new Date(submittedAt).toLocaleDateString(undefined,
    { year: 'numeric', month: 'short', day: 'numeric' }) : null;

  // Submission readiness check (uses persisted `base` so unsaved edits don't enable submit).
  const requiredFilled = role !== 'STUDENT' ? true : (
    !!base.firstName && !!base.surname && !!base.phone && !!base.country &&
    !!base.placeOfWork && !!base.positionAtWapcp
  );
  const allDocsUploaded = documents.degreeCertificate.uploaded
    && documents.practiceLicense.uploaded
    && documents.passportPhoto.uploaded;
  const canSubmitProfile = role === 'STUDENT' && !locked && !dirty && requiredFilled && allDocsUploaded;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-2xl bg-brand/15 text-brand grid place-items-center">
          <UserCircle2 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My profile</h1>
          <p className="text-sm text-muted-foreground">
            Keep your details up to date — these appear on your WAPCP records.
          </p>
        </div>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}

      {!loading && locked && (
        <Card className="p-4 flex items-start gap-3 border-emerald-200 bg-emerald-50/60">
          <CheckCircle2 className="h-5 w-5 text-emerald-700 mt-0.5" />
          <div className="flex-1 text-sm">
            <div className="font-medium text-emerald-900">Profile submitted</div>
            <p className="text-emerald-800/90 mt-0.5">
              Your details and documents were submitted{submittedDate ? ` on ${submittedDate}` : ''}.
              These are now locked — contact an administrator if any information needs to be changed.
            </p>
          </div>
        </Card>
      )}

      {!loading && (
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <Card className="p-5 flex items-center gap-5">
            <div className="relative h-20 w-20 shrink-0">
              {resolvedAvatar ? (
                <img src={resolvedAvatar} alt="Profile photo"
                  className="h-20 w-20 rounded-2xl object-cover ring-2 ring-white shadow-glass-lg" />
              ) : (
                <div className="h-20 w-20 rounded-2xl bg-brand/15 text-brand grid place-items-center text-2xl font-semibold ring-2 ring-white shadow-glass-lg">
                  {initial}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Profile photo</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                JPG, PNG, WEBP or GIF up to 2&nbsp;MB. Shown to faculty and classmates.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
                <Button type="button" variant="outline" disabled={avatarBusy || locked}
                  onClick={() => fileRef.current?.click()}>
                  <Camera className="h-4 w-4" /> {avatarUrl ? 'Replace photo' : 'Upload photo'}
                </Button>
                {avatarUrl && !locked && (
                  <Button type="button" variant="ghost" disabled={avatarBusy} onClick={onRemoveAvatar}>
                    <Trash2 className="h-4 w-4" /> Remove
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <Section icon={UserCircle2} title="Identity">
            <Field label="Title" htmlFor="title">
              <Select id="title" value={form.title} disabled={!canEdit}
                onChange={(e) => set('title', e.target.value)}>
                {TITLES.map((t) => <option key={t || 'none'} value={t}>{t || '—'}</option>)}
              </Select>
            </Field>
            {role === 'STUDENT' ? (
              <>
                <Field label="First name" htmlFor="firstName">
                  <Input id="firstName" value={form.firstName} disabled={!canEdit} maxLength={60}
                    onChange={(e) => set('firstName', e.target.value)} autoComplete="given-name" />
                </Field>
                <Field label="Surname" htmlFor="surname">
                  <Input id="surname" value={form.surname} disabled={!canEdit} maxLength={60}
                    onChange={(e) => set('surname', e.target.value)} autoComplete="family-name" />
                </Field>
              </>
            ) : (
              <Field label="Name" htmlFor="name">
                <Input id="name" value={form.name} disabled={!canEdit} maxLength={100} required
                  onChange={(e) => set('name', e.target.value)} autoComplete="name" />
              </Field>
            )}
          </Section>

          <Section icon={Mail} title="Contact">
            <Field label="Email" htmlFor="email">
              <Input id="email" value={user?.email ?? ''} disabled readOnly />
            </Field>
            <Field label="Phone number" htmlFor="phone" icon={Phone}>
              <Input id="phone" value={form.phone} disabled={!canEdit} maxLength={30}
                onChange={(e) => set('phone', e.target.value)} autoComplete="tel" inputMode="tel" />
            </Field>
            <Field label="Country of residence" htmlFor="country" icon={Globe2}>
              <Input id="country" value={form.country} disabled={!canEdit} maxLength={80}
                onChange={(e) => set('country', e.target.value)} autoComplete="country-name" />
            </Field>
          </Section>

          {role === 'TEACHER' && (
            <Section icon={BookOpen} title="Teaching">
              <Field label="Topics" htmlFor="topics">
                <Input id="topics" value={form.topics} disabled={!canEdit} maxLength={200}
                  onChange={(e) => set('topics', e.target.value)}
                  placeholder="e.g. Pharmaceutical Chemistry, Pharmacology" />
              </Field>
            </Section>
          )}

          {role === 'STUDENT' && (
            <>
              <Section icon={Briefcase} title="Professional">
                <Field label="Place of work" htmlFor="placeOfWork">
                  <Input id="placeOfWork" value={form.placeOfWork} disabled={!canEdit} maxLength={120}
                    onChange={(e) => set('placeOfWork', e.target.value)} autoComplete="organization" />
                </Field>
                <Field label="Position held at WAPCP" htmlFor="positionAtWapcp">
                  <Input id="positionAtWapcp" value={form.positionAtWapcp} disabled={!canEdit} maxLength={100}
                    onChange={(e) => set('positionAtWapcp', e.target.value)} />
                </Field>
              </Section>

              <Section icon={GraduationCap} title="Student record">
                <Field label="Registration number" htmlFor="registrationNumber">
                  <Input id="registrationNumber" value={form.registrationNumber} disabled={!canEdit} maxLength={40}
                    onChange={(e) => set('registrationNumber', e.target.value)} />
                </Field>
              </Section>

              <Card className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-8 w-8 rounded-xl bg-brand/15 text-brand grid place-items-center">
                    <FileBadge2 className="h-4 w-4" />
                  </div>
                  <h2 className="text-base font-semibold">Required documents</h2>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Upload clear scans or photos of the documents below. PDF or image files up to 10&nbsp;MB,
                  except the passport photograph which must be an image.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <DocumentCard
                    icon={FileText} label="Pharmacy degree certificate"
                    accept="application/pdf,image/*"
                    info={documents.degreeCertificate}
                    busy={!!docBusy['degree-certificate']}
                    locked={locked}
                    inputRef={docRefs['degree-certificate']}
                    onPick={(e) => onPickDoc('degree-certificate', e)}
                    onRemove={() => onRemoveDoc('degree-certificate')}
                  />
                  <DocumentCard
                    icon={FileBadge2} label="License to practice"
                    accept="application/pdf,image/*"
                    info={documents.practiceLicense}
                    busy={!!docBusy['practice-license']}
                    locked={locked}
                    inputRef={docRefs['practice-license']}
                    onPick={(e) => onPickDoc('practice-license', e)}
                    onRemove={() => onRemoveDoc('practice-license')}
                  />
                  <DocumentCard
                    icon={ImageIcon} label="Passport photograph"
                    accept="image/*"
                    info={documents.passportPhoto}
                    busy={!!docBusy['passport-photo']}
                    locked={locked}
                    inputRef={docRefs['passport-photo']}
                    onPick={(e) => onPickDoc('passport-photo', e)}
                    onRemove={() => onRemoveDoc('passport-photo')}
                  />
                </div>
              </Card>
            </>
          )}

          {error && <div className="text-sm text-destructive">{error}</div>}
          {saved && !dirty && <div className="text-sm text-emerald-700">Profile saved.</div>}

          {canEdit && (
            <div className="sticky bottom-0 -mx-1 mt-2 flex items-center justify-end gap-2 rounded-2xl glass-strong px-3 py-2">
              <Button type="button" variant="outline" disabled={!dirty || saving}
                onClick={() => { setForm(base); setSaved(false); setError(null); }}>
                Discard
              </Button>
              <Button type="submit" disabled={!dirty || saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          )}

          {role === 'STUDENT' && !locked && (
            <Card className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium flex items-center gap-1.5">
                  <Lock className="h-4 w-4 text-brand" />
                  Submit your profile
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Once submitted, your personal details and documents will be locked. Make sure
                  every field is correct and all three documents are uploaded before submitting.
                </p>
                {!canSubmitProfile && (
                  <p className="text-xs text-amber-700 mt-1">
                    {dirty
                      ? 'Save your pending changes before submitting.'
                      : !requiredFilled
                        ? 'Complete first name, surname, phone, country, place of work and position at WAPCP first.'
                        : !allDocsUploaded
                          ? 'Upload all three documents to enable submission.'
                          : ''}
                  </p>
                )}
              </div>
              <Button type="button" disabled={!canSubmitProfile || submitting}
                onClick={onSubmitProfile}>
                <Send className="h-4 w-4" />
                {submitting ? 'Submitting…' : 'Submit profile'}
              </Button>
            </Card>
          )}
        </form>
      )}
    </div>
  );
}

function DocumentCard({ icon: Icon, label, accept, info, busy, locked, inputRef, onPick, onRemove }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  accept: string;
  info: StudentDocumentInfo;
  busy: boolean;
  locked: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  const resolved = resolveApiUrl(info.url);
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className={cn('h-8 w-8 rounded-xl grid place-items-center',
          info.uploaded ? 'bg-emerald-100 text-emerald-700' : 'bg-brand/15 text-brand')}>
          {info.uploaded ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
        </div>
        <div className="text-sm font-medium flex-1 min-w-0 truncate">{label}</div>
      </div>
      <div className="text-xs text-muted-foreground min-h-[1.5rem] truncate">
        {info.uploaded
          ? (info.originalName ?? 'Uploaded')
          : 'Not uploaded yet'}
      </div>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={onPick} />
      <div className="flex flex-wrap gap-2">
        {!locked && (
          <Button type="button" size="sm" variant="outline" disabled={busy}
            onClick={() => inputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" />
            {info.uploaded ? 'Replace' : 'Upload'}
          </Button>
        )}
        {info.uploaded && resolved && (
          <Button type="button" size="sm" variant="ghost" asChild>
            <a href={resolved} target="_blank" rel="noreferrer">View</a>
          </Button>
        )}
        {info.uploaded && !locked && (
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </Button>
        )}
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-xl bg-brand/15 text-brand grid place-items-center">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </Card>
  );
}

function Field({ label, htmlFor, icon: Icon, children }: {
  label: string;
  htmlFor: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        {label}
      </Label>
      {children}
    </div>
  );
}

function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'flex h-10 w-full rounded-xl px-3 py-2 text-sm text-foreground',
        'glass-input transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    />
  );
}

function extractError(err: unknown): string | null {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; message?: string } | undefined;
    return data?.error ?? data?.message ?? err.message;
  }
  return null;
}
