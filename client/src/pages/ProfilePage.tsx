import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import axios from 'axios';
import {
  UserCircle2, Phone, Globe2, Briefcase, GraduationCap, Mail, BookOpen,
  Camera, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { resolveApiUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  deleteAvatar, getMyProfile, updateMyProfile, uploadAvatar,
} from '@/lib/profile';
import type { ProfileUpdate, Role, User } from '@/lib/types';

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
  matriculationNumber: string;
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
    matriculationNumber: u?.matriculationNumber ?? '',
    topics: u?.topics ?? '',
  };
}

function diff(form: Form, base: Form, role: Role | undefined): ProfileUpdate {
  const out: ProfileUpdate = {};
  const allowed = new Set<keyof Form>(
    role === 'STUDENT'
      ? ['title', 'firstName', 'surname', 'phone', 'country', 'placeOfWork', 'positionAtWapcp', 'matriculationNumber']
      : ['title', 'name', 'phone', 'country', 'topics'],
  );
  (Object.keys(form) as Array<keyof Form>).forEach((k) => {
    if (allowed.has(k) && form[k] !== base[k]) out[k] = form[k];
  });
  return out;
}

export function ProfilePage() {
  const { user, refresh } = useAuth();
  const [base, setBase] = useState<Form>(() => toForm(user));
  const [form, setForm] = useState<Form>(() => toForm(user));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const u = await getMyProfile();
        if (cancelled) return;
        const next = toForm(u);
        setBase(next);
        setForm(next);
        setAvatarUrl(u.avatarUrl);
      } catch (err) {
        if (!cancelled) setError(extractError(err) ?? 'Failed to load profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const role = user?.role;
  const canEdit = role === 'STUDENT' || role === 'TEACHER';
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
      const next = toForm(updated);
      setBase(next);
      setForm(next);
      setAvatarUrl(updated.avatarUrl);
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
      setAvatarUrl(updated.avatarUrl);
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
      setAvatarUrl(updated.avatarUrl);
      await refresh();
    } catch (err) {
      setError(extractError(err) ?? 'Failed to remove photo');
    } finally {
      setAvatarBusy(false);
    }
  }

  const initial = (form.name || form.firstName || user?.email || '?').slice(0, 1).toUpperCase();
  const resolvedAvatar = resolveApiUrl(avatarUrl);

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
                <Button type="button" variant="outline" disabled={avatarBusy}
                  onClick={() => fileRef.current?.click()}>
                  <Camera className="h-4 w-4" /> {avatarUrl ? 'Replace photo' : 'Upload photo'}
                </Button>
                {avatarUrl && (
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
                <Field label="Matriculation number" htmlFor="matriculationNumber">
                  <Input id="matriculationNumber" value={form.matriculationNumber} disabled={!canEdit} maxLength={40}
                    onChange={(e) => set('matriculationNumber', e.target.value)} />
                </Field>
              </Section>
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
        </form>
      )}
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
