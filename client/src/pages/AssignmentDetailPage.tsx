import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, CalendarClock, CheckCircle2, ClipboardList, Download,
  FileText, Pencil, Trash2, Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth-context';
import {
  attachmentDownloadUrl, deleteAssignment, deleteAttachment, getAssignment,
  listSubmissions, submitAssignment, submissionAttachmentDownloadUrl,
  submissionDownloadUrl, updateAssignment, uploadAttachments,
} from '@/lib/assignments';
import type { AssignmentDetail, Submission, SubmissionAttachment } from '@/lib/types';

export function AssignmentDetailPage() {
  const { classId = '', id = '' } = useParams<{ classId: string; id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isOwner = !!(assignment && user && (user.role === 'ADMIN' || user.id === assignment.createdById));
  const isStudent = user?.role === 'STUDENT';

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setAssignment(await getAssignment(id)); }
    catch (err) { setError(extractError(err) ?? 'Failed to load assignment'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function onDelete() {
    if (!assignment) return;
    try {
      await deleteAssignment(assignment.id);
      navigate(`/classes/${classId}`, { replace: true });
    } catch (err) {
      setActionError(extractError(err) ?? 'Failed to delete');
      setDeleteOpen(false);
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (error || !assignment) {
    return (
      <div className="flex flex-col gap-3">
        <div className="text-sm text-destructive">{error ?? 'Assignment not found'}</div>
        <Link to={`/classes/${classId}`} className="text-sm text-brand hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to class
        </Link>
      </div>
    );
  }

  const due = assignment.dueDate ? new Date(assignment.dueDate) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to={`/classes/${classId}`} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to class
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-brand/15 text-brand grid place-items-center">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{assignment.title}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>by {assignment.createdBy.name}</span>
                {due && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-4 w-4" /> Due {due.toLocaleString()}
                  </span>
                )}
                {isOwner && assignment.submissionCount !== undefined && (
                  <span className="inline-flex items-center gap-1">
                    <Upload className="h-4 w-4" /> {assignment.submissionCount} submission{assignment.submissionCount === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            </div>
          </div>
          {isOwner && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> Edit</Button>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" /> Delete</Button>
            </div>
          )}
        </div>
        {actionError && <div className="mt-3 text-sm text-destructive">{actionError}</div>}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h3 className="font-semibold mb-2">Instructions</h3>
          <p className="text-sm text-foreground/80 whitespace-pre-wrap">
            {assignment.description?.trim() || <span className="text-muted-foreground">No description provided.</span>}
          </p>
        </Card>
        <AttachmentsCard assignment={assignment} isOwner={isOwner} onChange={load} />
      </div>

      {isStudent && !isOwner && (
        <StudentSubmissionCard assignment={assignment} onSubmitted={load} />
      )}
      {isOwner && (
        <TeacherSubmissionsCard assignmentId={assignment.id} />
      )}

      <EditAssignmentDialog
        open={editOpen} assignment={assignment} onClose={() => setEditOpen(false)}
        onSaved={(updated) => { setAssignment({ ...assignment, ...updated }); setEditOpen(false); }}
      />
      <ConfirmDeleteDialog open={deleteOpen} title={assignment.title} onClose={() => setDeleteOpen(false)} onConfirm={onDelete} />
    </div>
  );
}

function AttachmentsCard({
  assignment, isOwner, onChange,
}: { assignment: AssignmentDetail; isOwner: boolean; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length === 0) return;
    setBusy(true); setError(null);
    try { await uploadAttachments(assignment.id, files); onChange(); }
    catch (err) { setError(extractError(err) ?? 'Upload failed'); }
    finally { setBusy(false); }
  }

  async function onDelete(attachmentId: string) {
    setError(null);
    try { await deleteAttachment(attachmentId); onChange(); }
    catch (err) { setError(extractError(err) ?? 'Delete failed'); }
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">Files</h3>
        {isOwner && (
          <label className="inline-flex items-center gap-1 text-xs text-brand cursor-pointer hover:underline">
            <Upload className="h-3.5 w-3.5" /> Add
            <input
              type="file" multiple className="hidden"
              accept=".pdf,.doc,.docx,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip,application/x-zip-compressed"
              onChange={onPickFiles} disabled={busy}
            />
          </label>
        )}
      </div>
      {assignment.attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attached files.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {assignment.attachments.map((att) => (
            <li key={att.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/70 backdrop-blur-md border border-foreground/10 px-3 py-2">
              <a href={attachmentDownloadUrl(att.id)} className="flex items-center gap-2 min-w-0 text-sm hover:text-brand">
                <FileText className="h-4 w-4 shrink-0" />
                <span className="truncate">{att.filename}</span>
                <span className="text-xs text-muted-foreground shrink-0">{formatBytes(att.size)}</span>
              </a>
              <div className="flex items-center gap-1">
                <a href={attachmentDownloadUrl(att.id)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground" aria-label="Download">
                  <Download className="h-4 w-4" />
                </a>
                {isOwner && (
                  <button type="button" onClick={() => onDelete(att.id)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive" aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {busy && <div className="mt-2 text-xs text-muted-foreground">Uploading…</div>}
      {error && <div className="mt-2 text-xs text-destructive">{error}</div>}
    </Card>
  );
}

function StudentSubmissionCard({
  assignment, onSubmitted,
}: { assignment: AssignmentDetail; onSubmitted: () => void }) {
  const mine = assignment.mySubmission ?? null;
  const graded = !!mine?.gradedAt;
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (files.length === 0) return;
    setBusy(true); setError(null);
    try { await submitAssignment(assignment.id, files); setFiles([]); onSubmitted(); }
    catch (err) { setError(extractError(err) ?? 'Failed to upload'); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <h3 className="font-semibold mb-2">Your submission</h3>
      {mine && (
        <div className="rounded-xl bg-white/70 backdrop-blur-md border border-foreground/10 p-3 mb-4">
          <SubmissionFileList
            attachments={mine.attachments}
            legacy={mine.filename ? { id: mine.id, filename: mine.filename, size: mine.size ?? null } : null}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Submitted {new Date(mine.submittedAt).toLocaleString()}</span>
            {mine.isLate && <span className="rounded-full bg-amber-500/20 text-amber-800 px-2 py-0.5 font-medium">LATE</span>}
            {graded && <span className="rounded-full bg-brand/15 text-brand px-2 py-0.5 font-medium inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Graded</span>}
          </div>
          {graded && (
            <div className="mt-3 border-t border-foreground/10 pt-3">
              <div className="text-2xl font-semibold text-brand">{mine.grade}<span className="text-base text-muted-foreground"> / 100</span></div>
              {mine.feedback && <p className="mt-2 text-sm text-foreground/80 whitespace-pre-wrap">{mine.feedback}</p>}
            </div>
          )}
        </div>
      )}
      {graded ? (
        <p className="text-xs text-muted-foreground">This submission has been graded — it can no longer be replaced.</p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Label htmlFor="sub-file">{mine ? 'Replace submission' : 'Upload your files'} (PDF, DOC, DOCX, ZIP — up to 10)</Label>
          <Input
            id="sub-file" type="file" required multiple
            accept=".pdf,.doc,.docx,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip,application/x-zip-compressed"
            onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
          />
          {files.length > 0 && (
            <p className="text-xs text-muted-foreground">{files.length} file{files.length === 1 ? '' : 's'} selected</p>
          )}
          {error && <div className="text-sm text-destructive">{error}</div>}
          <div className="flex justify-end">
            <Button type="submit" disabled={files.length === 0 || busy}>{busy ? 'Uploading…' : mine ? 'Replace submission' : 'Submit'}</Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function SubmissionFileList({
  attachments, legacy,
}: {
  attachments: SubmissionAttachment[];
  legacy: { id: string; filename: string; size: number | null } | null;
}) {
  if (attachments.length === 0 && legacy) {
    return (
      <a
        href={submissionDownloadUrl(legacy.id)}
        className="flex items-center justify-between gap-3 hover:text-brand"
      >
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 shrink-0 text-brand" />
          <span className="text-sm font-medium truncate">{legacy.filename}</span>
          {legacy.size !== null && <span className="text-xs text-muted-foreground">{formatBytes(legacy.size)}</span>}
        </div>
        <span className="text-xs text-brand inline-flex items-center gap-1">
          <Download className="h-3.5 w-3.5" /> Download
        </span>
      </a>
    );
  }
  if (attachments.length === 0) {
    return <p className="text-xs text-muted-foreground">No file attached.</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {attachments.map((a) => (
        <li key={a.id}>
          <a
            href={submissionAttachmentDownloadUrl(a.id)}
            className="flex items-center justify-between gap-3 hover:text-brand"
          >
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4 shrink-0 text-brand" />
              <span className="text-sm font-medium truncate">{a.filename}</span>
              <span className="text-xs text-muted-foreground shrink-0">{formatBytes(a.size)}</span>
            </div>
            <span className="text-xs text-brand inline-flex items-center gap-1 shrink-0">
              <Download className="h-3.5 w-3.5" /> Download
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function TeacherSubmissionsCard({ assignmentId }: { assignmentId: string }) {
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gradingId, setGradingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try { setSubmissions(await listSubmissions(assignmentId)); }
    catch (err) { setError(extractError(err) ?? 'Failed to load submissions'); }
  }, [assignmentId]);

  useEffect(() => { refresh(); }, [refresh]);

  const active = useMemo(() => submissions?.find((s) => s.id === gradingId) ?? null, [submissions, gradingId]);

  return (
    <Card>
      <h3 className="font-semibold mb-2">Submissions</h3>
      {error && <div className="text-sm text-destructive">{error}</div>}
      {submissions === null && !error && <div className="text-sm text-muted-foreground">Loading…</div>}
      {submissions && submissions.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">No submissions yet.</p>
      )}
      {submissions && submissions.length > 0 && (
        <ul className="divide-y divide-foreground/10">
          {submissions.map((s) => {
            const hasAttachments = s.attachments.length > 0;
            const hasLegacy = !hasAttachments && !!s.filename;
            return (
              <li key={s.id} className="flex flex-col gap-2 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-brand/15 text-brand grid place-items-center font-medium shrink-0">
                      {s.student.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{s.student.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{s.student.email}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Submitted {new Date(s.submittedAt).toLocaleString()}
                        {s.isLate && <span className="ml-2 rounded-full bg-amber-500/20 text-amber-800 px-2 py-0.5 font-medium">LATE</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.gradedAt && s.grade !== null && (
                      <span className="text-sm font-semibold text-brand">{s.grade}/100</span>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setGradingId(s.id)}>
                      {s.gradedAt ? 'Update grade' : 'Grade'}
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 pl-12">
                  {hasAttachments && s.attachments.map((a) => (
                    <a
                      key={a.id}
                      href={submissionAttachmentDownloadUrl(a.id)}
                      className="inline-flex items-center gap-1 text-xs text-brand hover:underline rounded-md bg-brand/10 px-2 py-1"
                      title={`${a.filename} · ${formatBytes(a.size)}`}
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span className="max-w-[16rem] truncate">{a.filename}</span>
                    </a>
                  ))}
                  {hasLegacy && (
                    <a
                      href={submissionDownloadUrl(s.id)}
                      className="inline-flex items-center gap-1 text-xs text-brand hover:underline rounded-md bg-brand/10 px-2 py-1"
                      title={s.filename ?? undefined}
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span className="max-w-[16rem] truncate">{s.filename}</span>
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <GradeDialog
        submission={active}
        onClose={() => setGradingId(null)}
        onGraded={(graded) => {
          setSubmissions((list) => (list ? list.map((x) => (x.id === graded.id ? graded : x)) : list));
          setGradingId(null);
        }}
      />
    </Card>
  );
}

function GradeDialog({
  submission, onClose, onGraded,
}: { submission: Submission | null; onClose: () => void; onGraded: (s: Submission) => void }) {
  const [grade, setGrade] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (submission) {
      setGrade(submission.grade !== null ? String(submission.grade) : '');
      setFeedback(submission.feedback ?? '');
      setError(null);
    }
  }, [submission?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!submission) return;
    const n = Number(grade);
    if (!Number.isFinite(n) || n < 0 || n > 100) { setError('Grade must be 0–100'); return; }
    setBusy(true); setError(null);
    try {
      const { gradeSubmission } = await import('@/lib/assignments');
      const updated = await gradeSubmission(submission.id, { grade: n, feedback: feedback.trim() || undefined });
      onGraded(updated);
    } catch (err) { setError(extractError(err) ?? 'Failed to save grade'); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={!!submission} onClose={onClose} title={`Grade — ${submission?.student.name ?? ''}`}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="g-grade">Grade (0–100)</Label>
          <Input id="g-grade" type="number" min={0} max={100} required value={grade} onChange={(e) => setGrade(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="g-fb">Feedback (optional)</Label>
          <Textarea id="g-fb" maxLength={5000} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What did the student do well? What could be improved?" />
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
        <div className="flex justify-end gap-2 mt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save grade'}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function EditAssignmentDialog({
  open, assignment, onClose, onSaved,
}: { open: boolean; assignment: AssignmentDetail; onClose: () => void; onSaved: (u: { title: string; description: string | null; dueDate: string | null }) => void }) {
  const [title, setTitle] = useState(assignment.title);
  const [description, setDescription] = useState(assignment.description ?? '');
  const [dueDate, setDueDate] = useState(assignment.dueDate ? toLocalInput(assignment.dueDate) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(assignment.title);
      setDescription(assignment.description ?? '');
      setDueDate(assignment.dueDate ? toLocalInput(assignment.dueDate) : '');
      setError(null);
    }
  }, [open, assignment.title, assignment.description, assignment.dueDate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const updated = await updateAssignment(assignment.id, {
        title: title.trim(),
        description: description.trim() ? description.trim() : null,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      });
      onSaved({ title: updated.title, description: updated.description, dueDate: updated.dueDate });
    } catch (err) { setError(extractError(err) ?? 'Failed to save'); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Edit assignment">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="e-title">Title</Label>
          <Input id="e-title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="e-desc">Description</Label>
          <Textarea id="e-desc" maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="e-due">Due date</Label>
          <Input id="e-due" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
        <div className="flex justify-end gap-2 mt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || !title.trim()}>{busy ? 'Saving…' : 'Save changes'}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function ConfirmDeleteDialog({
  open, title, onClose, onConfirm,
}: { open: boolean; title: string; onClose: () => void; onConfirm: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onClose={onClose} title="Delete assignment?" description="This will remove the assignment and all submissions.">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-foreground/80">Delete <span className="font-medium">{title}</span>?</p>
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

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function extractError(err: unknown): string | null {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; message?: string } | undefined;
    return data?.error ?? data?.message ?? err.message;
  }
  return null;
}
