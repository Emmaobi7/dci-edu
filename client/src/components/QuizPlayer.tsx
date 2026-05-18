import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Hourglass, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { saveQuizAnswers, submitQuizAttempt } from '@/lib/quizzes';
import type { QuizAttemptInProgress, QuizAttemptResult } from '@/lib/types';

interface Props {
  quizId: string;
  attempt: QuizAttemptInProgress;
  onSubmitted: (r: QuizAttemptResult) => void;
}

const SAVE_DEBOUNCE_MS = 800;

function formatRemaining(s: number): string {
  if (s < 0) return '∞';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function QuizPlayer({ quizId, attempt, onSubmitted }: Props) {
  const [answers, setAnswers] = useState<Record<string, number[]>>(attempt.answers ?? {});
  const [cursor, setCursor] = useState(0);
  const [remaining, setRemaining] = useState(attempt.remainingSeconds);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const submittedRef = useRef(false);

  const questions = attempt.questions;
  const current = questions[cursor]!;
  const hasTimer = attempt.quiz.timeLimitMinutes != null && remaining >= 0;
  const answeredCount = useMemo(
    () => questions.filter((q) => (answers[String(q.index)]?.length ?? 0) > 0).length,
    [answers, questions],
  );

  const persist = useCallback(async (next: Record<string, number[]>) => {
    setSaveState('saving');
    try {
      await saveQuizAnswers(quizId, next);
      setSaveState('saved');
    } catch (err) {
      setSaveState('error');
      setError(extractError(err) ?? 'Failed to save answers');
    }
  }, [quizId]);

  function scheduleSave(next: Record<string, number[]>) {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => { persist(next); }, SAVE_DEBOUNCE_MS);
  }

  function toggleAnswer(optIdx: number) {
    const key = String(current.index);
    const prev = answers[key] ?? [];
    let next: number[];
    if (current.type === 'MCQ_MULTI') {
      next = prev.includes(optIdx) ? prev.filter((v) => v !== optIdx) : [...prev, optIdx];
      next.sort((a, b) => a - b);
    } else {
      next = [optIdx];
    }
    const updated = { ...answers, [key]: next };
    setAnswers(updated);
    scheduleSave(updated);
  }

  const submit = useCallback(async (auto: boolean) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true); setError(null);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    try {
      const result = await submitQuizAttempt(quizId, answers);
      onSubmitted(result);
    } catch (err) {
      submittedRef.current = false;
      setError(extractError(err) ?? (auto ? 'Time is up but submit failed' : 'Failed to submit'));
    } finally {
      setSubmitting(false);
    }
  }, [answers, quizId, onSubmitted]);

  useEffect(() => {
    if (!hasTimer) return;
    if (remaining <= 0) {
      submit(true);
      return;
    }
    const id = window.setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => window.clearInterval(id);
  }, [hasTimer, remaining, submit]);

  useEffect(() => () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
  }, []);

  const selected = answers[String(current.index)] ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span className="font-medium">{attempt.quiz.title}</span>
          <span className="ml-2 text-muted-foreground">
            Question {cursor + 1} of {questions.length} • {answeredCount} answered
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {hasTimer && (
            <span className={`inline-flex items-center gap-1 font-mono ${remaining < 60 ? 'text-destructive' : ''}`}>
              <Hourglass className="h-4 w-4" /> {formatRemaining(remaining)}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Save failed' : ''}
          </span>
        </div>
      </Card>

      <Card>
        <h3 className="font-medium">Q{cursor + 1}. {current.prompt}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {current.type === 'MCQ_MULTI' ? 'Select all that apply' : current.type === 'TRUE_FALSE' ? 'Pick one' : 'Pick one'}
          {' • '}
          {current.points} pt{current.points === 1 ? '' : 's'}
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {current.options.map((opt) => {
            const checked = selected.includes(opt.index);
            return (
              <li key={opt.index}>
                <label className={`flex items-center gap-3 rounded-xl border px-3 py-2 cursor-pointer transition-colors ${checked ? 'border-brand bg-brand/5' : 'border-foreground/10 hover:bg-white/60'}`}>
                  <input
                    type={current.type === 'MCQ_MULTI' ? 'checkbox' : 'radio'}
                    name={`q-${current.index}`}
                    checked={checked}
                    onChange={() => toggleAnswer(opt.index)}
                  />
                  <span className="flex-1 text-sm">{opt.text}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {questions.map((q, i) => {
            const answered = (answers[String(q.index)]?.length ?? 0) > 0;
            const active = i === cursor;
            return (
              <button
                key={q.index}
                type="button"
                onClick={() => setCursor(i)}
                aria-label={`Go to question ${i + 1}`}
                className={`h-8 w-8 rounded-lg text-xs font-medium border transition-colors ${
                  active
                    ? 'border-brand bg-brand text-white'
                    : answered
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
                    : 'border-foreground/10 bg-white/60 text-muted-foreground hover:text-foreground'
                }`}
              >{i + 1}</button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setCursor((c) => Math.max(0, c - 1))}
            disabled={cursor === 0}
          ><ChevronLeft className="h-4 w-4" /> Prev</Button>
          {cursor < questions.length - 1 ? (
            <Button
              type="button"
              onClick={() => setCursor((c) => Math.min(questions.length - 1, c + 1))}
            >Next <ChevronRight className="h-4 w-4" /></Button>
          ) : (
            <Button type="button" onClick={() => submit(false)} disabled={submitting}>
              <Send className="h-4 w-4" /> {submitting ? 'Submitting…' : 'Submit exam'}
            </Button>
          )}
        </div>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
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

