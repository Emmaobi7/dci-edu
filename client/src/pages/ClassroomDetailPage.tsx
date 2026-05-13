import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, BookOpen, Check, Copy, GraduationCap, LogOut, Pencil,
  RefreshCw, Trash2, UserMinus, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth-context';
import {
  deleteClassroom, getClassroom, leaveClassroom, listMembers,
  regenerateCode, removeMember, updateClassroom,
} from '@/lib/classrooms';
import type { ClassroomDetail, EnrolmentMember } from '@/lib/types';
import { AssignmentsTab } from '@/components/AssignmentsTab';

type TabKey = 'overview' | 'assignments' | 'members';

export function ClassroomDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [classroom, setClassroom] = useState<ClassroomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('overview');

  const [members, setMembers] = useState<EnrolmentMember[] | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isOwner = !!(classroom && user && (user.role === 'ADMIN' || user.id === classroom.teacherId));
  const isStudentMember = !!(classroom && user?.role === 'STUDENT');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setClassroom(await getClassroom(id));
    } catch (err) {
      setError(extractError(err) ?? 'Failed to load class');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadMembers = useCallback(async () => {
    setMembersLoading(true); setMembersError(null);
    try {
      setMembers(await listMembers(id));
    } catch (err) {
      setMembersError(extractError(err) ?? 'Failed to load members');
    } finally {
      setMembersLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab === 'members' && isOwner && !members && !membersLoading) {
      loadMembers();
    }
  }, [tab, isOwner, members, membersLoading, loadMembers]);

  async function copyCode() {
    if (!classroom?.code) return;
    try {
      await navigator.clipboard.writeText(classroom.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  }

  async function onRegenerate() {
    if (!classroom) return;
    setRegenBusy(true); setActionError(null);
    try {
      const updated = await regenerateCode(classroom.id);
      setClassroom({ ...classroom, ...updated });
    } catch (err) {
      setActionError(extractError(err) ?? 'Failed to regenerate code');
    } finally {
      setRegenBusy(false);
    }
  }

  async function onDelete() {
    if (!classroom) return;
    try {
      await deleteClassroom(classroom.id);
      navigate('/classes', { replace: true });
    } catch (err) {
      setActionError(extractError(err) ?? 'Failed to delete class');
      setDeleteOpen(false);
    }
  }

  async function onLeave() {
    if (!classroom) return;
    try {
      await leaveClassroom(classroom.id);
      navigate('/classes', { replace: true });
    } catch (err) {
      setActionError(extractError(err) ?? 'Failed to leave class');
    }
  }

  async function onRemoveMember(studentId: string) {
    if (!classroom) return;
    try {
      await removeMember(classroom.id, studentId);
      setMembers((m) => (m ? m.filter((x) => x.student.id !== studentId) : m));
      setClassroom((c) => (c ? { ...c, studentCount: Math.max(0, c.studentCount - 1) } : c));
    } catch (err) {
      setMembersError(extractError(err) ?? 'Failed to remove student');
    }
  }

  const tabs = useMemo(() => {
    const base: { key: TabKey; label: string }[] = [
      { key: 'overview', label: 'Overview' },
      { key: 'assignments', label: 'Assignments' },
    ];
    if (isOwner) base.push({ key: 'members', label: `Members (${classroom?.studentCount ?? 0})` });
    return base;
  }, [isOwner, classroom?.studentCount]);

  if (loading) return <div className="text-sm text-muted-foreground">Loading class…</div>;
  if (error || !classroom) {
    return (
      <div className="flex flex-col gap-3">
        <div className="text-sm text-destructive">{error ?? 'Class not found'}</div>
        <Link to="/classes" className="text-sm text-brand hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to classes
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/classes" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> All classes
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-brand/15 text-brand grid place-items-center">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{classroom.name}</h1>
              <p className="text-sm text-muted-foreground mt-1 inline-flex items-center gap-2">
                <GraduationCap className="h-4 w-4" /> {classroom.teacher.name}
                <span className="text-foreground/30">•</span>
                <Users className="h-4 w-4" /> {classroom.studentCount} {classroom.studentCount === 1 ? 'student' : 'students'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isOwner && (
              <>
                <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> Edit</Button>
                <Button variant="destructive" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" /> Delete</Button>
              </>
            )}
            {isStudentMember && (
              <Button variant="outline" onClick={onLeave}><LogOut className="h-4 w-4" /> Leave class</Button>
            )}
          </div>
        </div>
        {actionError && <div className="mt-3 text-sm text-destructive">{actionError}</div>}
      </div>

      <div className="flex gap-2 border-b border-foreground/10">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-brand text-brand' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <h3 className="font-semibold mb-2">About this class</h3>
            <p className="text-sm text-foreground/80 whitespace-pre-wrap">
              {classroom.description?.trim() || <span className="text-muted-foreground">No description yet.</span>}
            </p>
          </Card>
          {isOwner && classroom.code && (
            <Card>
              <h3 className="font-semibold mb-2">Class code</h3>
              <p className="text-xs text-muted-foreground mb-3">Share this code with students so they can join.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-xl bg-white/80 border border-foreground/10 px-3 py-2 font-mono text-lg tracking-[0.35em] text-center">{classroom.code}</code>
                <Button size="icon" variant="outline" onClick={copyCode} aria-label="Copy code">
                  {copied ? <Check className="h-4 w-4 text-brand" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={onRegenerate} disabled={regenBusy}>
                <RefreshCw className={`h-4 w-4 ${regenBusy ? 'animate-spin' : ''}`} /> Regenerate code
              </Button>
            </Card>
          )}
        </div>
      )}

      {tab === 'assignments' && (
        <AssignmentsTab classroomId={classroom.id} viewerRole={user?.role} isOwner={isOwner} />
      )}

      {tab === 'members' && isOwner && (
        <Card>
          {membersLoading && <div className="text-sm text-muted-foreground">Loading members…</div>}
          {membersError && <div className="text-sm text-destructive">{membersError}</div>}
          {!membersLoading && members && members.length === 0 && (
            <div className="text-sm text-muted-foreground py-6 text-center">No students have joined yet.</div>
          )}
          {!membersLoading && members && members.length > 0 && (
            <ul className="divide-y divide-foreground/10">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-brand/15 text-brand grid place-items-center font-medium shrink-0">
                      {m.student.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{m.student.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{m.student.email}</div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => onRemoveMember(m.student.id)}>
                    <UserMinus className="h-4 w-4" /> Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <EditClassDialog
        open={editOpen}
        classroom={classroom}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => { setClassroom({ ...classroom, ...updated }); setEditOpen(false); }}
      />
      <ConfirmDeleteDialog
        open={deleteOpen}
        name={classroom.name}
        onClose={() => setDeleteOpen(false)}
        onConfirm={onDelete}
      />
    </div>
  );
}

function EditClassDialog({
  open, classroom, onClose, onSaved,
}: { open: boolean; classroom: ClassroomDetail; onClose: () => void; onSaved: (c: { name: string; description: string | null }) => void }) {
  const [name, setName] = useState(classroom.name);
  const [description, setDescription] = useState(classroom.description ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(classroom.name);
      setDescription(classroom.description ?? '');
      setError(null);
    }
  }, [open, classroom.name, classroom.description]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      const updated = await updateClassroom(classroom.id, {
        name: name.trim(),
        description: description.trim() ? description.trim() : null,
      });
      onSaved({ name: updated.name, description: updated.description });
    } catch (err) {
      setError(extractError(err) ?? 'Failed to save changes');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Edit class">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-name">Class name</Label>
          <Input id="edit-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-desc">Description</Label>
          <Textarea id="edit-desc" maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
        <div className="flex justify-end gap-2 mt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={submitting || !name.trim()}>{submitting ? 'Saving…' : 'Save changes'}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function ConfirmDeleteDialog({
  open, name, onClose, onConfirm,
}: { open: boolean; name: string; onClose: () => void; onConfirm: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onClose={onClose} title="Delete class?" description="This will permanently remove the class and all enrolments.">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-foreground/80">Are you sure you want to delete <span className="font-medium">{name}</span>?</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="button" variant="destructive" disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>
            {busy ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </div>
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
