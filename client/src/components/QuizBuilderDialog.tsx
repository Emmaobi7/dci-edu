import { useEffect, useMemo, useState, type FormEvent } from 'react';
import axios from 'axios';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createQuiz, updateQuiz, type QuizInput } from '@/lib/quizzes';
import type { QuestionType, QuizQuestionAuthor } from '@/lib/types';

export interface QuizBuilderInitial {
  title: string;
  description: string | null;
  timeLimitMinutes: number | null;
  dueDate: string | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showAnswers: boolean;
  questions: QuizQuestionAuthor[];
}

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
} & (
  | { mode: 'create'; classroomId: string }
  | { mode: 'edit'; quizId: string; initial: QuizBuilderInitial }
);

function emptyQuestion(type: QuestionType = 'MCQ_SINGLE'): QuizQuestionAuthor {
  if (type === 'TRUE_FALSE') {
    return { type, prompt: '', options: ['True', 'False'], correctIndices: [0], points: 1 };
  }
  return { type, prompt: '', options: ['', ''], correctIndices: [], points: 1 };
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export function QuizBuilderDialog(props: Props) {
  const { open, onClose, onSaved } = props;
  const initial: QuizBuilderInitial | null = props.mode === 'edit' ? props.initial : null;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimit, setTimeLimit] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [showAnswers, setShowAnswers] = useState(true);
  const [questions, setQuestions] = useState<QuizQuestionAuthor[]>([emptyQuestion()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title);
      setDescription(initial.description ?? '');
      setTimeLimit(initial.timeLimitMinutes ? String(initial.timeLimitMinutes) : '');
      setDueDate(toDateInputValue(initial.dueDate));
      setShuffleQuestions(initial.shuffleQuestions);
      setShuffleOptions(initial.shuffleOptions);
      setShowAnswers(initial.showAnswers);
      setQuestions(initial.questions.length > 0 ? initial.questions : [emptyQuestion()]);
    } else {
      setTitle(''); setDescription(''); setTimeLimit(''); setDueDate('');
      setShuffleQuestions(false); setShuffleOptions(true); setShowAnswers(true);
      setQuestions([emptyQuestion()]);
    }
    setError(null);
    setSubmitting(false);
  }, [open, initial]);

  const totalPoints = useMemo(
    () => questions.reduce((s, q) => s + (q.points || 0), 0),
    [questions],
  );

  function patchQuestion(i: number, patch: Partial<QuizQuestionAuthor>) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }

  function changeType(i: number, type: QuestionType) {
    setQuestions((qs) =>
      qs.map((q, idx) => {
        if (idx !== i) return q;
        if (type === 'TRUE_FALSE') {
          return { ...q, type, options: ['True', 'False'], correctIndices: q.correctIndices.slice(0, 1).filter((x) => x < 2) };
        }
        if (q.type === 'TRUE_FALSE') {
          return { ...q, type, options: ['', ''], correctIndices: [] };
        }
        // single<->multi: keep options; trim correctIndices to first if going to single
        const trimmed = type === 'MCQ_SINGLE' ? q.correctIndices.slice(0, 1) : q.correctIndices;
        return { ...q, type, correctIndices: trimmed };
      }),
    );
  }

  function toggleCorrect(i: number, optIdx: number) {
    setQuestions((qs) =>
      qs.map((q, idx) => {
        if (idx !== i) return q;
        if (q.type === 'MCQ_SINGLE' || q.type === 'TRUE_FALSE') {
          return { ...q, correctIndices: [optIdx] };
        }
        const has = q.correctIndices.includes(optIdx);
        const next = has ? q.correctIndices.filter((v) => v !== optIdx) : [...q.correctIndices, optIdx];
        return { ...q, correctIndices: next.sort((a, b) => a - b) };
      }),
    );
  }

  function setOptionText(i: number, optIdx: number, text: string) {
    setQuestions((qs) =>
      qs.map((q, idx) => {
        if (idx !== i) return q;
        const opts = q.options.slice();
        opts[optIdx] = text;
        return { ...q, options: opts };
      }),
    );
  }

  function addOption(i: number) {
    setQuestions((qs) =>
      qs.map((q, idx) => {
        if (idx !== i || q.type === 'TRUE_FALSE' || q.options.length >= 10) return q;
        return { ...q, options: [...q.options, ''] };
      }),
    );
  }

  function removeOption(i: number, optIdx: number) {
    setQuestions((qs) =>
      qs.map((q, idx) => {
        if (idx !== i || q.type === 'TRUE_FALSE' || q.options.length <= 2) return q;
        const opts = q.options.filter((_, k) => k !== optIdx);
        const corrected = q.correctIndices
          .filter((v) => v !== optIdx)
          .map((v) => (v > optIdx ? v - 1 : v));
        return { ...q, options: opts, correctIndices: corrected };
      }),
    );
  }

  function addQuestion() {
    setQuestions((qs) => [...qs, emptyQuestion()]);
  }

  function removeQuestion(i: number) {
    setQuestions((qs) => (qs.length <= 1 ? qs : qs.filter((_, idx) => idx !== i)));
  }

  function validate(): string | null {
    if (!title.trim()) return 'Title is required';
    if (questions.length === 0) return 'Add at least one question';
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]!;
      if (!q.prompt.trim()) return `Question ${i + 1}: prompt is required`;
      if (q.options.some((o) => !o.trim())) return `Question ${i + 1}: every option needs text`;
      if (q.correctIndices.length === 0) return `Question ${i + 1}: pick at least one correct answer`;
      if (q.type === 'MCQ_SINGLE' && q.correctIndices.length !== 1) {
        return `Question ${i + 1}: single-choice needs exactly one correct answer`;
      }
      if (q.type === 'MCQ_MULTI' && q.correctIndices.length < 1) {
        return `Question ${i + 1}: select at least one correct answer`;
      }
    }
    return null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const v = validate();
    if (v) { setError(v); return; }
    setSubmitting(true); setError(null);
    try {
      const payload: QuizInput = {
        title: title.trim(),
        description: description.trim() || undefined,
        timeLimitMinutes: timeLimit.trim() ? Number(timeLimit) : null,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        shuffleQuestions,
        shuffleOptions,
        showAnswers,
        questions: questions.map((q) => ({
          type: q.type,
          prompt: q.prompt.trim(),
          options: q.options.map((o) => o.trim()),
          correctIndices: [...q.correctIndices].sort((a, b) => a - b),
          points: q.points || 1,
        })),
      };
      if (props.mode === 'create') {
        await createQuiz(props.classroomId, payload);
      } else {
        await updateQuiz(props.quizId, payload);
      }
      onSaved();
    } catch (err) {
      setError(extractError(err) ?? 'Failed to save quiz');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={props.mode === 'create' ? 'New quiz' : 'Edit quiz'}
      description="Auto-graded with binary scoring (all-or-nothing per question)."
      className="max-w-3xl"
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="q-title">Title</Label>
            <Input id="q-title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="q-desc">Description (optional)</Label>
            <Textarea id="q-desc" maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-time">Time limit (minutes)</Label>
            <Input id="q-time" type="number" min={1} max={360} value={timeLimit}
              onChange={(e) => setTimeLimit(e.target.value)} placeholder="Optional" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-due">Due date</Label>
            <Input id="q-due" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={shuffleQuestions} onChange={(e) => setShuffleQuestions(e.target.checked)} />
            Shuffle questions per student
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={shuffleOptions} onChange={(e) => setShuffleOptions(e.target.checked)} />
            Shuffle options per student
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showAnswers} onChange={(e) => setShowAnswers(e.target.checked)} />
            Show correct answers after submission
          </label>
        </div>

        <div className="flex flex-col gap-3">
          {questions.map((q, i) => (
            <QuestionEditor
              key={i}
              index={i}
              question={q}
              onChangeType={(t) => changeType(i, t)}
              onChangePrompt={(p) => patchQuestion(i, { prompt: p })}
              onChangePoints={(pts) => patchQuestion(i, { points: pts })}
              onSetOptionText={(oi, t) => setOptionText(i, oi, t)}
              onAddOption={() => addOption(i)}
              onRemoveOption={(oi) => removeOption(i, oi)}
              onToggleCorrect={(oi) => toggleCorrect(i, oi)}
              onRemove={() => removeQuestion(i)}
              canRemove={questions.length > 1}
            />
          ))}
          <Button type="button" variant="outline" onClick={addQuestion} className="self-start">
            <Plus className="h-4 w-4" /> Add question
          </Button>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}
        <div className="flex items-center justify-between gap-2 mt-1">
          <span className="text-xs text-muted-foreground">
            {questions.length} question{questions.length === 1 ? '' : 's'} • {totalPoints} pt{totalPoints === 1 ? '' : 's'}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : props.mode === 'create' ? 'Create quiz' : 'Save changes'}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

interface QuestionEditorProps {
  index: number;
  question: QuizQuestionAuthor;
  onChangeType: (t: QuestionType) => void;
  onChangePrompt: (p: string) => void;
  onChangePoints: (pts: number) => void;
  onSetOptionText: (i: number, t: string) => void;
  onAddOption: () => void;
  onRemoveOption: (i: number) => void;
  onToggleCorrect: (i: number) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function QuestionEditor({
  index, question, onChangeType, onChangePrompt, onChangePoints,
  onSetOptionText, onAddOption, onRemoveOption, onToggleCorrect, onRemove, canRemove,
}: QuestionEditorProps) {
  const isMulti = question.type === 'MCQ_MULTI';
  const isTF = question.type === 'TRUE_FALSE';
  return (
    <Card className="bg-white/40">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Question {index + 1}</span>
          <select
            value={question.type}
            onChange={(e) => onChangeType(e.target.value as QuestionType)}
            className="h-8 rounded-lg border border-foreground/10 bg-white/80 px-2 text-xs"
          >
            <option value="MCQ_SINGLE">Single choice</option>
            <option value="MCQ_MULTI">Multiple choice</option>
            <option value="TRUE_FALSE">True / False</option>
          </select>
          <div className="flex items-center gap-1 text-xs">
            <Label htmlFor={`pts-${index}`} className="text-muted-foreground">Points</Label>
            <Input
              id={`pts-${index}`}
              type="number"
              min={1}
              max={100}
              value={question.points}
              onChange={(e) => onChangePoints(Math.max(1, Number(e.target.value) || 1))}
              className="h-8 w-16"
            />
          </div>
        </div>
        {canRemove && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
        )}
      </div>
      <Textarea
        value={question.prompt}
        onChange={(e) => onChangePrompt(e.target.value)}
        placeholder="Question prompt"
        maxLength={2000}
        rows={2}
      />
      <ul className="mt-3 flex flex-col gap-2">
        {question.options.map((opt, oi) => {
          const checked = question.correctIndices.includes(oi);
          return (
            <li key={oi} className="flex items-center gap-2">
              <input
                type={isMulti ? 'checkbox' : 'radio'}
                name={`q-${index}-correct`}
                checked={checked}
                onChange={() => onToggleCorrect(oi)}
                aria-label={`Mark option ${oi + 1} as correct`}
              />
              <Input
                value={opt}
                onChange={(e) => onSetOptionText(oi, e.target.value)}
                placeholder={isTF ? (oi === 0 ? 'True' : 'False') : `Option ${oi + 1}`}
                maxLength={500}
                disabled={isTF}
                className="flex-1"
              />
              {!isTF && question.options.length > 2 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => onRemoveOption(oi)} aria-label="Remove option">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {!isTF && question.options.length < 10 && (
        <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={onAddOption}>
          <Plus className="h-4 w-4" /> Add option
        </Button>
      )}
    </Card>
  );
}

function extractError(err: unknown): string | null {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; message?: string } | undefined;
    return data?.error ?? data?.message ?? err.message;
  }
  return null;
}
