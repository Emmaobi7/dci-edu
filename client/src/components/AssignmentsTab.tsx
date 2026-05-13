import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { CalendarClock, CheckCircle2, ClipboardList, Clock, Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createAssignment, listAssignments, uploadAttachments } from '@/lib/assignments';
import type { Assignment, Role } from '@/lib/types';

export function AssignmentsTab({
  classroomId, viewerRole, isOwner,
}: { classroomId: string; viewerRole: Role | undefined; isOwner: boolean }) {
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setAssignments(await listAssignments(classroomId));
    } catch (err) {
      setError(extractError(err) ?? 'Failed to load assignments');
    }
  }, [classroomId]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Assignments</h2>
        {isOwner && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New assignment
          </Button>
        )}
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
      {assignments === null && !error && <div className="text-sm text-muted-foreground">Loading…</div>}
      {assignments && assignments.length === 0 && (
        <Card className="text-center py-10">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-brand/15 text-brand grid place-items-center mb-3">
            <ClipboardList className="h-6 w-6" />
          </div>
          <h3 className="font-semibold">No assignments yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isOwner ? 'Create your first assignment for this class.' : 'Your teacher has not posted any assignments.'}
          </p>
          {isOwner && (
            <div className="mt-4">
              <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New assignment</Button>
            </div>
          )}
        </Card>
      )}

      {assignments && assignments.length > 0 && (
        <ul className="flex flex-col gap-3">
          {assignments.map((a) => (
            <AssignmentRow key={a.id} classroomId={classroomId} a={a} viewerRole={viewerRole} isOwner={isOwner} />
          ))}
        </ul>
      )}

      <CreateAssignmentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        classroomId={classroomId}
        onCreated={() => { setCreateOpen(false); refresh(); }}
      />
    </div>
  );
}

function AssignmentRow({
  classroomId, a, viewerRole, isOwner,
}: { classroomId: string; a: Assignment; viewerRole: Role | undefined; isOwner: boolean }) {
  const due = a.dueDate ? new Date(a.dueDate) : null;
  const overdue = due ? Date.now() > due.getTime() : false;
  const status = describeStudentStatus(a, overdue);

  return (
    <Link to={`/classes/${classroomId}/assignments/${a.id}`} className="block group">
      <Card className="transition-transform group-hover:-translate-y-0.5 group-hover:shadow-glass-lg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-brand/15 text-brand grid place-items-center shrink-0">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold truncate">{a.title}</h3>
              {a.description && <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{a.description}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {due && (
                  <span className={`inline-flex items-center gap-1 ${overdue && !isOwner ? 'text-destructive' : ''}`}>
                    <CalendarClock className="h-3.5 w-3.5" /> Due {due.toLocaleString()}
                  </span>
                )}
                {a.attachments.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <ClipboardList className="h-3.5 w-3.5" /> {a.attachments.length} file{a.attachments.length === 1 ? '' : 's'}
                  </span>
                )}
                {isOwner && a._count && (
                  <span className="inline-flex items-center gap-1">
                    <Upload className="h-3.5 w-3.5" /> {a._count.submissions} submission{a._count.submissions === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            </div>
          </div>
          {viewerRole === 'STUDENT' && status && (
            <StatusPill status={status} />
          )}
        </div>
      </Card>
    </Link>
  );
}

type Status = 'graded' | 'submitted' | 'late' | 'missing' | 'overdue';

function describeStudentStatus(a: Assignment, overdue: boolean): Status | null {
  const mine = a.mySubmission;
  if (mine) {
    if (mine.gradedAt) return 'graded';
    if (mine.isLate) return 'late';
    return 'submitted';
  }
  return overdue ? 'overdue' : 'missing';
}

function StatusPill({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string; Icon: typeof Clock }> = {
    graded:    { label: 'Graded',    cls: 'bg-brand/15 text-brand',                Icon: CheckCircle2 },
    submitted: { label: 'Submitted', cls: 'bg-emerald-500/15 text-emerald-700',    Icon: CheckCircle2 },
    late:      { label: 'Late',      cls: 'bg-amber-500/20 text-amber-800',        Icon: Clock },
    overdue:   { label: 'Overdue',   cls: 'bg-destructive/15 text-destructive',    Icon: Clock },
    missing:   { label: 'Not submitted', cls: 'bg-foreground/10 text-foreground/70', Icon: Clock },
  };
  const { label, cls, Icon } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </span>
  );
}

function CreateAssignmentDialog({
  open, onClose, classroomId, onCreated,
}: { open: boolean; onClose: () => void; classroomId: string; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setTitle(''); setDescription(''); setDueDate(''); setFiles([]); setError(null); setSubmitting(false); }
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      const dueIso = dueDate ? new Date(dueDate).toISOString() : null;
      const created = await createAssignment(classroomId, {
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueIso,
      });
      if (files.length > 0) {
        await uploadAttachments(created.id, files);
      }
      onCreated();
    } catch (err) {
      setError(extractError(err) ?? 'Failed to create assignment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="New assignment" description="Post a task for your class.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="a-title">Title</Label>
          <Input id="a-title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Essay on antibiotics" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="a-desc">Description (optional)</Label>
          <Textarea id="a-desc" maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Instructions, expectations, references…" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="a-due">Due date (optional)</Label>
          <Input id="a-due" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="a-files">Instruction files (PDF, DOC, DOCX)</Label>
          <Input
            id="a-files" type="file" multiple
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
          />
          {files.length > 0 && (
            <p className="text-xs text-muted-foreground">{files.length} file{files.length === 1 ? '' : 's'} selected</p>
          )}
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
        <div className="flex justify-end gap-2 mt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={submitting || !title.trim()}>{submitting ? 'Creating…' : 'Create assignment'}</Button>
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
