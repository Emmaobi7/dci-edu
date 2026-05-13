import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { BookOpen, GraduationCap, Plus, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth-context';
import { createClassroom, joinByCode, listClassrooms } from '@/lib/classrooms';
import type { Classroom } from '@/lib/types';

export function ClassesPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setClasses(await listClassrooms());
    } catch (err) {
      setError(extractError(err) ?? 'Failed to load classes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';
  const isStudent = user?.role === 'STUDENT';

  const heading = useMemo(() => {
    if (user?.role === 'TEACHER') return 'My classes';
    if (user?.role === 'STUDENT') return 'Enrolled classes';
    return 'All classes';
  }, [user?.role]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{heading}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isTeacher ? 'Create classes and share the code with your students.' : 'Classes you have joined.'}
          </p>
        </div>
        <div className="flex gap-2">
          {isStudent && (
            <Button variant="outline" onClick={() => setJoinOpen(true)}>
              <UserPlus className="h-4 w-4" /> Join with code
            </Button>
          )}
          {isTeacher && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New class
            </Button>
          )}
        </div>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading classes…</div>}
      {error && <div className="text-sm text-destructive">{error}</div>}

      {!loading && !error && classes.length === 0 && (
        <EmptyState isTeacher={isTeacher} isStudent={isStudent} onCreate={() => setCreateOpen(true)} onJoin={() => setJoinOpen(true)} />
      )}

      {!loading && classes.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <ClassCard key={c.id} classroom={c} viewerRole={user?.role} />
          ))}
        </div>
      )}

      <CreateClassDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          refresh();
        }}
      />
      <JoinClassDialog
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        onJoined={() => {
          setJoinOpen(false);
          refresh();
        }}
      />
    </div>
  );
}

function ClassCard({ classroom, viewerRole }: { classroom: Classroom; viewerRole?: string }) {
  const count = classroom._count?.enrolments ?? 0;
  return (
    <Link to={`/classes/${classroom.id}`} className="group block">
      <Card className="h-full transition-transform group-hover:-translate-y-0.5 group-hover:shadow-glass-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand/15 text-brand grid place-items-center">
            <BookOpen className="h-5 w-5" />
          </div>
          {viewerRole !== 'STUDENT' && classroom.code && (
            <span className="rounded-lg bg-white/70 backdrop-blur-md border border-foreground/10 px-2 py-1 text-[11px] font-mono tracking-widest text-foreground/80">
              {classroom.code}
            </span>
          )}
        </div>
        <div className="mt-4">
          <h3 className="font-semibold text-foreground line-clamp-1">{classroom.name}</h3>
          {classroom.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{classroom.description}</p>
          )}
        </div>
        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <GraduationCap className="h-3.5 w-3.5" /> {classroom.teacher.name}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {count} {count === 1 ? 'student' : 'students'}
          </span>
        </div>
      </Card>
    </Link>
  );
}

function EmptyState({
  isTeacher, isStudent, onCreate, onJoin,
}: { isTeacher: boolean; isStudent: boolean; onCreate: () => void; onJoin: () => void }) {
  return (
    <Card className="text-center py-12">
      <div className="mx-auto h-12 w-12 rounded-2xl bg-brand/15 text-brand grid place-items-center mb-3">
        <BookOpen className="h-6 w-6" />
      </div>
      <h3 className="font-semibold text-lg">No classes yet</h3>
      <p className="text-sm text-muted-foreground mt-1">
        {isTeacher ? 'Create your first class to get started.' : isStudent ? 'Ask your teacher for a class code to join.' : 'No classes available.'}
      </p>
      <div className="mt-5 flex justify-center gap-2">
        {isTeacher && <Button onClick={onCreate}><Plus className="h-4 w-4" /> New class</Button>}
        {isStudent && <Button variant="outline" onClick={onJoin}><UserPlus className="h-4 w-4" /> Join with code</Button>}
      </div>
    </Card>
  );
}

function CreateClassDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setName(''); setDescription(''); setError(null); setSubmitting(false); }
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createClassroom({ name: name.trim(), description: description.trim() || undefined });
      onCreated();
    } catch (err) {
      setError(extractError(err) ?? 'Failed to create class');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Create a class" description="Students will join with the generated code.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cls-name">Class name</Label>
          <Input id="cls-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Clinical Pharmacology" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cls-desc">Description (optional)</Label>
          <Textarea id="cls-desc" maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this class about?" />
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
        <div className="flex justify-end gap-2 mt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={submitting || !name.trim()}>{submitting ? 'Creating…' : 'Create class'}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function JoinClassDialog({ open, onClose, onJoined }: { open: boolean; onClose: () => void; onJoined: () => void }) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setCode(''); setError(null); setSubmitting(false); }
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await joinByCode(code.trim().toUpperCase());
      onJoined();
    } catch (err) {
      setError(extractError(err) ?? 'Failed to join class');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Join a class" description="Enter the code your teacher shared with you.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cls-code">Class code</Label>
          <Input
            id="cls-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. K7H2QP"
            className="font-mono tracking-[0.4em] uppercase text-center"
            maxLength={16}
            autoCapitalize="characters"
            autoComplete="off"
          />
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
        <div className="flex justify-end gap-2 mt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={submitting || code.trim().length < 4}>{submitting ? 'Joining…' : 'Join'}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function extractError(err: unknown): string | null {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; message?: string } | undefined;
    return data?.error ?? data?.message ?? err.message;
  }
  return null;
}
