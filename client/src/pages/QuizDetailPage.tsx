import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, CalendarClock, FileQuestion, Hourglass, Pencil, Play, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth-context';
import {
  deleteQuiz, getMyQuizAttempt, getQuiz, listQuizAttempts, startQuizAttempt,
} from '@/lib/quizzes';
import type {
  QuizAttemptInProgress, QuizAttemptResult, QuizAttemptRow, QuizDetail,
} from '@/lib/types';
import { QuizBuilderDialog } from '@/components/QuizBuilderDialog';
import { QuizPlayer } from '@/components/QuizPlayer';
import { QuizResultView } from '@/components/QuizResultView';
import { TeacherAttemptsList } from '@/components/TeacherAttemptsList';

export function QuizDetailPage() {
  const { classId = '', id = '' } = useParams<{ classId: string; id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOwner = !!(quiz && user && (user.role === 'ADMIN' || user.id === quiz.createdById));

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setQuiz(await getQuiz(id));
    } catch (err) {
      setError(extractError(err) ?? 'Failed to load quiz');
    }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  if (error && !quiz) {
    return (
      <div className="flex flex-col gap-3">
        <div className="text-sm text-destructive">{error}</div>
        <Link to={`/classes/${classId}`} className="text-sm text-brand hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to class
        </Link>
      </div>
    );
  }
  if (!quiz) return <div className="text-sm text-muted-foreground">Loading quiz…</div>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to={`/classes/${classId}`} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to class
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-12 w-12 rounded-2xl bg-brand/15 text-brand grid place-items-center shrink-0">
              <FileQuestion className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight truncate">{quiz.title}</h1>
              {quiz.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{quiz.description}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {quiz.dueDate && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5" /> Due {new Date(quiz.dueDate).toLocaleString()}
                  </span>
                )}
                {quiz.timeLimitMinutes && (
                  <span className="inline-flex items-center gap-1">
                    <Hourglass className="h-3.5 w-3.5" /> {quiz.timeLimitMinutes} min
                  </span>
                )}
                <span>{quiz.totalPoints} pt{quiz.totalPoints === 1 ? '' : 's'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isOwner ? (
        <TeacherView
          quiz={quiz}
          classId={classId}
          onChanged={refresh}
          onDeleted={() => navigate(`/classes/${classId}`, { replace: true })}
        />
      ) : (
        <StudentView quiz={quiz} classId={classId} />
      )}
    </div>
  );
}

function TeacherView({
  quiz, classId, onChanged, onDeleted,
}: { quiz: QuizDetail; classId: string; onChanged: () => void; onDeleted: () => void }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [attempts, setAttempts] = useState<QuizAttemptRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshAttempts = useCallback(async () => {
    setError(null);
    try { setAttempts(await listQuizAttempts(quiz.id)); }
    catch (err) { setError(extractError(err) ?? 'Failed to load attempts'); }
  }, [quiz.id]);

  useEffect(() => { refreshAttempts(); }, [refreshAttempts]);

  const initial = useMemo(() => ({
    title: quiz.title,
    description: quiz.description,
    timeLimitMinutes: quiz.timeLimitMinutes,
    dueDate: quiz.dueDate,
    shuffleQuestions: quiz.shuffleQuestions,
    shuffleOptions: quiz.shuffleOptions,
    showAnswers: quiz.showAnswers,
    questions: quiz.questions ?? [],
  }), [quiz]);

  const hasAttempts = (quiz._count?.attempts ?? 0) > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setEditOpen(true)} disabled={hasAttempts}
          title={hasAttempts ? 'Cannot edit a quiz with attempts' : ''}>
          <Pencil className="h-4 w-4" /> Edit quiz
        </Button>
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
      <Card>
        <h2 className="font-semibold mb-3">Student attempts</h2>
        <TeacherAttemptsList
          attempts={attempts}
          classId={classId}
        />
      </Card>

      <QuizBuilderDialog
        open={editOpen}
        mode="edit"
        quizId={quiz.id}
        initial={initial}
        onClose={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); onChanged(); }}
      />

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete quiz?" description="This will permanently delete the quiz and all attempts.">
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button type="button" variant="destructive" onClick={async () => {
            try { await deleteQuiz(quiz.id); onDeleted(); }
            catch (err) { setError(extractError(err) ?? 'Failed to delete quiz'); setDeleteOpen(false); }
          }}><Trash2 className="h-4 w-4" /> Delete</Button>
        </div>
      </Dialog>
    </div>
  );
}

type StudentState =
  | { kind: 'landing' }
  | { kind: 'playing'; attempt: QuizAttemptInProgress }
  | { kind: 'submitted'; result: QuizAttemptResult };

function StudentView({ quiz, classId }: { quiz: QuizDetail; classId: string }) {
  const [state, setState] = useState<StudentState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const loadAttempt = useCallback(async () => {
    setError(null);
    try {
      const r = await getMyQuizAttempt(quiz.id);
      if (r.state === 'in-progress') setState({ kind: 'playing', attempt: r.attempt });
      else setState({ kind: 'submitted', result: r.attempt });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setState({ kind: 'landing' });
        return;
      }
      setError(extractError(err) ?? 'Failed to load attempt');
    }
  }, [quiz.id]);

  useEffect(() => { loadAttempt(); }, [loadAttempt]);

  async function onStart() {
    setStarting(true); setError(null);
    try {
      await startQuizAttempt(quiz.id);
      await loadAttempt();
    } catch (err) {
      setError(extractError(err) ?? 'Failed to start quiz');
    } finally {
      setStarting(false);
    }
  }

  if (error) return <div className="text-sm text-destructive">{error}</div>;
  if (!state) return <div className="text-sm text-muted-foreground">Loading…</div>;

  if (state.kind === 'landing') {
    const overdue = !!(quiz.dueDate && Date.now() > new Date(quiz.dueDate).getTime());
    return (
      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">Ready to start?</h2>
        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
          {quiz.timeLimitMinutes
            ? <li>You will have <span className="font-medium text-foreground">{quiz.timeLimitMinutes} minutes</span> once you start.</li>
            : <li>No time limit.</li>}
          <li>You can revisit previous questions and change answers before submitting.</li>
          <li>Once you submit, you cannot retake the quiz.</li>
          {overdue && <li className="text-destructive">The due date has passed — your submission will be marked late.</li>}
        </ul>
        <div>
          <Button onClick={onStart} disabled={starting}>
            <Play className="h-4 w-4" /> {starting ? 'Starting…' : 'Start quiz'}
          </Button>
        </div>
      </Card>
    );
  }

  if (state.kind === 'playing') {
    return (
      <QuizPlayer
        quizId={quiz.id}
        attempt={state.attempt}
        onSubmitted={(r) => setState({ kind: 'submitted', result: r })}
      />
    );
  }

  return (
    <QuizResultView result={state.result} backTo={`/classes/${classId}`} />
  );
}

function extractError(err: unknown): string | null {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; message?: string } | undefined;
    return data?.error ?? data?.message ?? err.message;
  }
  return null;
}
