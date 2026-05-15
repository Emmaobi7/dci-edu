import { api } from './api';
import type {
  QuizAttemptInProgress, QuizAttemptResult, QuizAttemptRow,
  QuizDetail, QuizQuestionAuthor, QuizSummary,
} from './types';

export interface QuizInput {
  title: string;
  description?: string;
  timeLimitMinutes?: number | null;
  dueDate?: string | null;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  showAnswers?: boolean;
  questions: QuizQuestionAuthor[];
}

export async function listQuizzes(classroomId: string): Promise<QuizSummary[]> {
  const { data } = await api.get<{ quizzes: QuizSummary[] }>(`/classrooms/${classroomId}/quizzes`);
  return data.quizzes;
}

export async function createQuiz(classroomId: string, input: QuizInput): Promise<QuizSummary> {
  const { data } = await api.post<{ quiz: QuizSummary }>(
    `/classrooms/${classroomId}/quizzes`,
    input,
  );
  return data.quiz;
}

export async function getQuiz(id: string): Promise<QuizDetail> {
  const { data } = await api.get<{ quiz: QuizDetail }>(`/quizzes/${id}`);
  return data.quiz;
}

export async function updateQuiz(id: string, input: Partial<QuizInput>): Promise<QuizSummary> {
  const { data } = await api.patch<{ quiz: QuizSummary }>(`/quizzes/${id}`, input);
  return data.quiz;
}

export async function deleteQuiz(id: string): Promise<void> {
  await api.delete(`/quizzes/${id}`);
}

export interface StartAttemptResult {
  attemptId: string;
  resumed: boolean;
}

export async function startQuizAttempt(quizId: string): Promise<StartAttemptResult> {
  const { data } = await api.post<StartAttemptResult>(`/quizzes/${quizId}/attempts`);
  return data;
}

export type MyAttemptResponse =
  | { state: 'in-progress'; attempt: QuizAttemptInProgress }
  | { state: 'submitted'; attempt: QuizAttemptResult };

export async function getMyQuizAttempt(quizId: string): Promise<MyAttemptResponse> {
  const { data } = await api.get<{ attempt: QuizAttemptInProgress | QuizAttemptResult }>(
    `/quizzes/${quizId}/attempts/me`,
  );
  const a = data.attempt;
  if (a.submittedAt) {
    return { state: 'submitted', attempt: a as QuizAttemptResult };
  }
  return { state: 'in-progress', attempt: a as QuizAttemptInProgress };
}

export async function saveQuizAnswers(
  quizId: string,
  answers: Record<string, number[]>,
): Promise<void> {
  await api.patch(`/quizzes/${quizId}/attempts/me`, { answers });
}

export async function submitQuizAttempt(
  quizId: string,
  answers: Record<string, number[]>,
): Promise<QuizAttemptResult> {
  const { data } = await api.post<{ attempt: QuizAttemptResult }>(
    `/quizzes/${quizId}/attempts/me/submit`,
    { answers },
  );
  return data.attempt;
}

export async function listQuizAttempts(quizId: string): Promise<QuizAttemptRow[]> {
  const { data } = await api.get<{ attempts: QuizAttemptRow[] }>(`/quizzes/${quizId}/attempts`);
  return data.attempts;
}

export async function getQuizAttempt(attemptId: string): Promise<QuizAttemptResult> {
  const { data } = await api.get<{ attempt: QuizAttemptResult }>(`/quizzes/attempts/${attemptId}`);
  return data.attempt;
}
