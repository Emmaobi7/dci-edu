import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../utils/HttpError.js';
import {
  ensureClassroomMember,
  ensureClassroomOwner,
  isOwnerOrAdmin,
} from '../utils/classroomAuth.js';
import {
  createQuizSchema,
  updateQuizSchema,
  type QuizQuestion,
} from '../schemas/quiz.schema.js';
import { notifyClassroom, truncatePreview } from '../utils/notifications.js';

function requireUser(req: Request) {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  return req.user;
}

const quizSummarySelect = {
  id: true,
  classroomId: true,
  createdById: true,
  title: true,
  description: true,
  timeLimitMinutes: true,
  dueDate: true,
  shuffleQuestions: true,
  shuffleOptions: true,
  showAnswers: true,
  totalPoints: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true, email: true } },
  _count: { select: { attempts: true } },
} as const;

function totalPointsOf(questions: QuizQuestion[]): number {
  return questions.reduce((acc, q) => acc + (q.points ?? 1), 0);
}

export async function createQuiz(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id: classroomId } = req.params as { id: string };
  await ensureClassroomOwner(user, classroomId);

  const data = createQuizSchema.parse(req.body);
  const quiz = await prisma.quiz.create({
    data: {
      classroomId,
      createdById: user.id,
      title: data.title,
      description: data.description ?? null,
      timeLimitMinutes: data.timeLimitMinutes ?? null,
      dueDate: data.dueDate ?? null,
      shuffleQuestions: data.shuffleQuestions,
      shuffleOptions: data.shuffleOptions,
      showAnswers: data.showAnswers,
      questions: data.questions,
      totalPoints: totalPointsOf(data.questions),
    },
    select: quizSummarySelect,
  });
  await notifyClassroom({
    classroomId,
    actorId: user.id,
    type: 'QUIZ_NEW',
    title: `New quiz: ${quiz.title}`,
    body: quiz.description ? truncatePreview(quiz.description) : null,
    quizId: quiz.id,
  });
  res.status(201).json({ quiz });
}

export async function listQuizzes(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id: classroomId } = req.params as { id: string };
  const { isOwner } = await ensureClassroomMember(user, classroomId);

  const quizzes = await prisma.quiz.findMany({
    where: { classroomId },
    orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    select: {
      ...quizSummarySelect,
      ...(isOwner
        ? {}
        : {
            attempts: {
              where: { studentId: user.id },
              select: {
                id: true, submittedAt: true, score: true, totalPoints: true, isLate: true,
              },
            },
          }),
    },
  });

  if (isOwner) {
    res.json({ quizzes });
    return;
  }
  const payload = quizzes.map((q) => {
    const attempts = (q as unknown as { attempts: unknown[] }).attempts ?? [];
    const myAttempt = attempts[0] ?? null;
    const { attempts: _drop, ...rest } = q as unknown as { attempts: unknown[] } & typeof q;
    void _drop;
    return { ...rest, myAttempt };
  });
  res.json({ quizzes: payload });
}

export async function getQuiz(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params as { id: string };
  const quiz = await prisma.quiz.findUnique({
    where: { id },
    select: { ...quizSummarySelect, questions: true, classroom: { select: { teacherId: true } } },
  });
  if (!quiz) throw new HttpError(404, 'Quiz not found');
  await ensureClassroomMember(user, quiz.classroomId);
  const isOwner = isOwnerOrAdmin(user, quiz.classroom.teacherId);
  const { questions, classroom: _c, ...rest } = quiz;
  void _c;
  // Teachers see full questions (with correct answers).
  // Students see them via the attempt endpoint, in shuffled order, without answers.
  res.json({ quiz: { ...rest, questions: isOwner ? questions : undefined } });
}

export async function updateQuiz(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params as { id: string };
  const existing = await prisma.quiz.findUnique({
    where: { id },
    select: {
      id: true, classroomId: true,
      classroom: { select: { teacherId: true } },
      _count: { select: { attempts: true } },
    },
  });
  if (!existing) throw new HttpError(404, 'Quiz not found');
  if (!isOwnerOrAdmin(user, existing.classroom.teacherId)) throw new HttpError(403, 'Forbidden');
  if (existing._count.attempts > 0) {
    throw new HttpError(409, 'Cannot edit a quiz that already has attempts');
  }
  const data = updateQuizSchema.parse(req.body);
  const updated = await prisma.quiz.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.timeLimitMinutes !== undefined ? { timeLimitMinutes: data.timeLimitMinutes } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
      ...(data.shuffleQuestions !== undefined ? { shuffleQuestions: data.shuffleQuestions } : {}),
      ...(data.shuffleOptions !== undefined ? { shuffleOptions: data.shuffleOptions } : {}),
      ...(data.showAnswers !== undefined ? { showAnswers: data.showAnswers } : {}),
      ...(data.questions !== undefined
        ? { questions: data.questions, totalPoints: totalPointsOf(data.questions) }
        : {}),
    },
    select: quizSummarySelect,
  });
  res.json({ quiz: updated });
}

export async function deleteQuiz(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params as { id: string };
  const existing = await prisma.quiz.findUnique({
    where: { id },
    select: { id: true, classroom: { select: { teacherId: true } } },
  });
  if (!existing) throw new HttpError(404, 'Quiz not found');
  if (!isOwnerOrAdmin(user, existing.classroom.teacherId)) throw new HttpError(403, 'Forbidden');
  await prisma.quiz.delete({ where: { id } });
  res.status(204).end();
}
