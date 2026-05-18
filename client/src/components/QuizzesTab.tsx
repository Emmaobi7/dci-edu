import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  CalendarClock, CheckCircle2, Clock, FileQuestion, Hourglass, Plus, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { listQuizzes } from '@/lib/quizzes';
import type { QuizSummary, Role } from '@/lib/types';
import { QuizBuilderDialog } from '@/components/QuizBuilderDialog';

export function QuizzesTab({
  classroomId, viewerRole, isOwner,
}: { classroomId: string; viewerRole: Role | undefined; isOwner: boolean }) {
  const [quizzes, setQuizzes] = useState<QuizSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setQuizzes(await listQuizzes(classroomId));
    } catch (err) {
      setError(extractError(err) ?? 'Failed to load exams');
    }
  }, [classroomId]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Exams</h2>
        {isOwner && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New exam
          </Button>
        )}
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
      {quizzes === null && !error && <div className="text-sm text-muted-foreground">Loading…</div>}
      {quizzes && quizzes.length === 0 && (
        <Card className="text-center py-10">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-brand/15 text-brand grid place-items-center mb-3">
            <FileQuestion className="h-6 w-6" />
          </div>
          <h3 className="font-semibold">No exams yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isOwner ? 'Build your first auto-graded exam.' : 'Your faculty has not posted any exams.'}
          </p>
          {isOwner && (
            <div className="mt-4">
              <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New exam</Button>
            </div>
          )}
        </Card>
      )}

      {quizzes && quizzes.length > 0 && (
        <ul className="flex flex-col gap-3">
          {quizzes.map((q) => (
            <QuizRow
              key={q.id}
              classroomId={classroomId}
              q={q}
              viewerRole={viewerRole}
              isOwner={isOwner}
            />
          ))}
        </ul>
      )}

      {isOwner && (
        <QuizBuilderDialog
          open={createOpen}
          mode="create"
          classroomId={classroomId}
          onClose={() => setCreateOpen(false)}
          onSaved={() => { setCreateOpen(false); refresh(); }}
        />
      )}
    </div>
  );
}

function QuizRow({
  classroomId, q, viewerRole, isOwner,
}: { classroomId: string; q: QuizSummary; viewerRole: Role | undefined; isOwner: boolean }) {
  const due = q.dueDate ? new Date(q.dueDate) : null;
  const overdue = due ? Date.now() > due.getTime() : false;
  const status = describeStudentStatus(q, overdue);

  return (
    <Link to={`/classes/${classroomId}/quizzes/${q.id}`} className="block group">
      <Card className="transition-transform group-hover:-translate-y-0.5 group-hover:shadow-glass-lg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-brand/15 text-brand grid place-items-center shrink-0">
              <FileQuestion className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold truncate">{q.title}</h3>
              {q.description && <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{q.description}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {due && (
                  <span className={`inline-flex items-center gap-1 ${overdue && !isOwner ? 'text-destructive' : ''}`}>
                    <CalendarClock className="h-3.5 w-3.5" /> Due {due.toLocaleString()}
                  </span>
                )}
                {q.timeLimitMinutes && (
                  <span className="inline-flex items-center gap-1">
                    <Hourglass className="h-3.5 w-3.5" /> {q.timeLimitMinutes} min
                  </span>
                )}
                <span className="inline-flex items-center gap-1">{q.totalPoints} pt{q.totalPoints === 1 ? '' : 's'}</span>
                {isOwner && q._count && (
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {q._count.attempts} attempt{q._count.attempts === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            </div>
          </div>
          {viewerRole === 'STUDENT' && status && <StatusPill status={status} />}
        </div>
      </Card>
    </Link>
  );
}

type Status = 'graded' | 'late' | 'overdue' | 'missing';

function describeStudentStatus(q: QuizSummary, overdue: boolean): Status | null {
  const mine = q.myAttempt;
  if (mine?.submittedAt) {
    if (mine.isLate) return 'late';
    return 'graded';
  }
  return overdue ? 'overdue' : 'missing';
}

function StatusPill({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string; Icon: typeof Clock }> = {
    graded:  { label: 'Submitted', cls: 'bg-emerald-500/15 text-emerald-700', Icon: CheckCircle2 },
    late:    { label: 'Late',      cls: 'bg-amber-500/20 text-amber-800',     Icon: Clock },
    overdue: { label: 'Overdue',   cls: 'bg-destructive/15 text-destructive', Icon: Clock },
    missing: { label: 'Not started', cls: 'bg-foreground/10 text-foreground/70', Icon: Clock },
  };
  const { label, cls, Icon } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </span>
  );
}

function extractError(err: unknown): string | null {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; message?: string } | undefined;
    return data?.error ?? data?.message ?? err.message;
  }
  return null;
}
