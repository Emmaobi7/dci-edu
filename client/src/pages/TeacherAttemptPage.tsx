import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft } from 'lucide-react';
import { getQuizAttempt } from '@/lib/quizzes';
import type { QuizAttemptResult } from '@/lib/types';
import { QuizResultView } from '@/components/QuizResultView';

export function TeacherAttemptPage() {
  const { classId = '', id: quizId = '', attemptId = '' } = useParams<{
    classId: string; id: string; attemptId: string;
  }>();
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try { setResult(await getQuizAttempt(attemptId)); }
      catch (err) { setError(extractError(err) ?? 'Failed to load attempt'); }
    })();
  }, [attemptId]);

  if (error) {
    return (
      <div className="flex flex-col gap-3">
        <div className="text-sm text-destructive">{error}</div>
        <Link to={`/classes/${classId}/quizzes/${quizId}`} className="text-sm text-brand hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to quiz
        </Link>
      </div>
    );
  }
  if (!result) return <div className="text-sm text-muted-foreground">Loading attempt…</div>;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link to={`/classes/${classId}/quizzes/${quizId}`} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to quiz
        </Link>
        {result.student && (
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            {result.student.name}
            <span className="ml-2 text-sm font-normal text-muted-foreground">{result.student.email}</span>
          </h1>
        )}
      </div>
      <QuizResultView result={result} backTo={`/classes/${classId}/quizzes/${quizId}`} backLabel="Back to quiz" />
    </div>
  );
}

function extractError(err: unknown): string | null {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; message?: string } | undefined;
    return data?.error ?? data?.message ?? err.message;
  }
  return null;
}
