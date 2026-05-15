import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../utils/HttpError.js';
import { ensureClassroomMember, isOwnerOrAdmin } from '../utils/classroomAuth.js';
import { saveAnswersSchema, type QuizQuestion } from '../schemas/quiz.schema.js';

function requireUser(req: Request) {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  return req.user;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
}

function setsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const v of b) if (!sa.has(v)) return false;
  return true;
}

/** Server-truth remaining seconds; -1 means no time limit. */
function remainingSeconds(quiz: { timeLimitMinutes: number | null }, startedAt: Date): number {
  if (!quiz.timeLimitMinutes) return -1;
  const ms = quiz.timeLimitMinutes * 60_000 - (Date.now() - startedAt.getTime());
  return Math.max(0, Math.floor(ms / 1000));
}

function projectQuestionsForStudent(
  questions: QuizQuestion[],
  questionOrder: number[],
  optionOrders: number[][],
) {
  return questionOrder.map((originalIdx) => {
    const q = questions[originalIdx]!;
    const order = optionOrders[originalIdx] ?? q.options.map((_, i) => i);
    return {
      index: originalIdx,
      type: q.type,
      prompt: q.prompt,
      points: q.points,
      options: order.map((optIdx) => ({ index: optIdx, text: q.options[optIdx]! })),
    };
  });
}

export async function startAttempt(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id: quizId } = req.params as { id: string };
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: {
      id: true, classroomId: true, title: true, timeLimitMinutes: true, dueDate: true,
      shuffleQuestions: true, shuffleOptions: true, totalPoints: true, questions: true,
    },
  });
  if (!quiz) throw new HttpError(404, 'Quiz not found');
  await ensureClassroomMember(user, quiz.classroomId);
  if (user.role !== 'STUDENT') throw new HttpError(403, 'Students only');

  const existing = await prisma.quizAttempt.findUnique({
    where: { quizId_studentId: { quizId, studentId: user.id } },
    select: { id: true, submittedAt: true },
  });
  if (existing?.submittedAt) throw new HttpError(409, 'You have already submitted this quiz');
  if (existing) {
    res.status(200).json({ attemptId: existing.id, resumed: true });
    return;
  }

  const questions = quiz.questions as unknown as QuizQuestion[];
  const base = questions.map((_, i) => i);
  const questionOrder = quiz.shuffleQuestions ? shuffle(base) : base;
  const optionOrders = questions.map((q) =>
    quiz.shuffleOptions ? shuffle(q.options.map((_, i) => i)) : q.options.map((_, i) => i),
  );
  const attempt = await prisma.quizAttempt.create({
    data: {
      quizId,
      studentId: user.id,
      questionOrder,
      optionOrders,
      answers: {},
      totalPoints: quiz.totalPoints,
    },
    select: { id: true },
  });
  res.status(201).json({ attemptId: attempt.id, resumed: false });
}

export async function getMyAttempt(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id: quizId } = req.params as { id: string };
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: {
      id: true, classroomId: true, title: true, description: true,
      timeLimitMinutes: true, dueDate: true, shuffleOptions: true, showAnswers: true,
      totalPoints: true, questions: true,
    },
  });
  if (!quiz) throw new HttpError(404, 'Quiz not found');
  await ensureClassroomMember(user, quiz.classroomId);

  const attempt = await prisma.quizAttempt.findUnique({
    where: { quizId_studentId: { quizId, studentId: user.id } },
  });
  if (!attempt) throw new HttpError(404, 'No attempt started');

  const questions = quiz.questions as unknown as QuizQuestion[];
  const projected = projectQuestionsForStudent(
    questions,
    attempt.questionOrder as number[],
    attempt.optionOrders as number[][],
  );
  void quiz.shuffleOptions; // already applied in optionOrders

  if (attempt.submittedAt) {
    res.json({
      attempt: buildResult(quiz, questions, attempt, projected),
    });
    return;
  }
  res.json({
    attempt: {
      id: attempt.id,
      quizId,
      startedAt: attempt.startedAt,
      submittedAt: null,
      remainingSeconds: remainingSeconds(quiz, attempt.startedAt),
      totalPoints: attempt.totalPoints,
      answers: attempt.answers ?? {},
      questions: projected,
      quiz: {
        id: quiz.id, title: quiz.title, description: quiz.description,
        timeLimitMinutes: quiz.timeLimitMinutes, dueDate: quiz.dueDate,
      },
    },
  });
}


type AttemptRecord = {
  id: string;
  quizId: string;
  studentId: string;
  startedAt: Date;
  submittedAt: Date | null;
  isLate: boolean;
  score: number | null;
  totalPoints: number;
  answers: unknown;
  questionOrder: unknown;
  optionOrders: unknown;
};

function buildResult(
  quiz: { id: string; title: string; description: string | null; showAnswers: boolean; totalPoints: number },
  questions: QuizQuestion[],
  attempt: AttemptRecord,
  projected: ReturnType<typeof projectQuestionsForStudent>,
) {
  const answers = (attempt.answers ?? {}) as Record<string, number[]>;
  const perQuestion = projected.map((p) => {
    const original = questions[p.index]!;
    const selected = answers[String(p.index)] ?? [];
    const correct = setsEqual(selected, original.correctIndices);
    return {
      index: p.index,
      type: p.type,
      prompt: p.prompt,
      options: p.options,
      points: p.points,
      selectedIndices: selected,
      correct,
      ...(quiz.showAnswers ? { correctIndices: original.correctIndices } : {}),
    };
  });
  return {
    id: attempt.id,
    quizId: attempt.quizId,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    isLate: attempt.isLate,
    score: attempt.score,
    totalPoints: attempt.totalPoints,
    showAnswers: quiz.showAnswers,
    questions: perQuestion,
    quiz: { id: quiz.id, title: quiz.title, description: quiz.description },
  };
}

export async function saveAnswers(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id: quizId } = req.params as { id: string };
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true, classroomId: true, timeLimitMinutes: true, questions: true },
  });
  if (!quiz) throw new HttpError(404, 'Quiz not found');
  await ensureClassroomMember(user, quiz.classroomId);
  const attempt = await prisma.quizAttempt.findUnique({
    where: { quizId_studentId: { quizId, studentId: user.id } },
  });
  if (!attempt) throw new HttpError(404, 'No attempt started');
  if (attempt.submittedAt) throw new HttpError(409, 'Attempt already submitted');
  if (remainingSeconds(quiz, attempt.startedAt) === 0) {
    throw new HttpError(409, 'Time is up');
  }
  const { answers } = saveAnswersSchema.parse(req.body);
  // Validate every key is a numeric index in range and each option index is valid.
  const questions = quiz.questions as unknown as QuizQuestion[];
  const normalized: Record<string, number[]> = {};
  for (const [key, sel] of Object.entries(answers)) {
    const qi = Number(key);
    if (!Number.isInteger(qi) || qi < 0 || qi >= questions.length) continue;
    const q = questions[qi]!;
    const valid = sel.filter((v) => v >= 0 && v < q.options.length);
    normalized[String(qi)] = Array.from(new Set(valid));
  }
  await prisma.quizAttempt.update({
    where: { id: attempt.id },
    data: { answers: normalized },
  });
  res.json({ ok: true });
}

export async function submitAttempt(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id: quizId } = req.params as { id: string };
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: {
      id: true, classroomId: true, title: true, description: true,
      timeLimitMinutes: true, dueDate: true, showAnswers: true,
      totalPoints: true, questions: true,
    },
  });
  if (!quiz) throw new HttpError(404, 'Quiz not found');
  await ensureClassroomMember(user, quiz.classroomId);
  const attempt = await prisma.quizAttempt.findUnique({
    where: { quizId_studentId: { quizId, studentId: user.id } },
  });
  if (!attempt) throw new HttpError(404, 'No attempt started');
  if (attempt.submittedAt) throw new HttpError(409, 'Attempt already submitted');

  // Optional final snapshot of answers.
  if (req.body && typeof req.body === 'object' && 'answers' in req.body) {
    const { answers } = saveAnswersSchema.parse(req.body);
    const questions = quiz.questions as unknown as QuizQuestion[];
    const normalized: Record<string, number[]> = {};
    for (const [key, sel] of Object.entries(answers)) {
      const qi = Number(key);
      if (!Number.isInteger(qi) || qi < 0 || qi >= questions.length) continue;
      const q = questions[qi]!;
      const valid = sel.filter((v) => v >= 0 && v < q.options.length);
      normalized[String(qi)] = Array.from(new Set(valid));
    }
    attempt.answers = normalized;
  }

  const questions = quiz.questions as unknown as QuizQuestion[];
  const saved = (attempt.answers ?? {}) as Record<string, number[]>;
  let score = 0;
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]!;
    const sel = saved[String(i)] ?? [];
    if (setsEqual(sel, q.correctIndices)) score += q.points ?? 1;
  }
  const now = new Date();
  const isLate = !!(quiz.dueDate && now > quiz.dueDate);
  const updated = await prisma.quizAttempt.update({
    where: { id: attempt.id },
    data: { answers: saved, score, submittedAt: now, isLate },
  });
  const projected = projectQuestionsForStudent(
    questions,
    updated.questionOrder as number[],
    updated.optionOrders as number[][],
  );
  res.json({ attempt: buildResult(quiz, questions, updated, projected) });
}

export async function listAttempts(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id: quizId } = req.params as { id: string };
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true, classroomId: true, classroom: { select: { teacherId: true } } },
  });
  if (!quiz) throw new HttpError(404, 'Quiz not found');
  if (!isOwnerOrAdmin(user, quiz.classroom.teacherId)) throw new HttpError(403, 'Forbidden');
  const attempts = await prisma.quizAttempt.findMany({
    where: { quizId },
    orderBy: [{ submittedAt: { sort: 'desc', nulls: 'last' } }, { startedAt: 'desc' }],
    select: {
      id: true, studentId: true, startedAt: true, submittedAt: true,
      score: true, totalPoints: true, isLate: true,
      student: { select: { id: true, name: true, email: true } },
    },
  });
  res.json({ attempts });
}

export async function getAttempt(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { attemptId } = req.params as { attemptId: string };
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      student: { select: { id: true, name: true, email: true } },
      quiz: {
        select: {
          id: true, classroomId: true, title: true, description: true,
          showAnswers: true, totalPoints: true, questions: true,
          classroom: { select: { teacherId: true } },
        },
      },
    },
  });
  if (!attempt) throw new HttpError(404, 'Attempt not found');
  if (!isOwnerOrAdmin(user, attempt.quiz.classroom.teacherId)) throw new HttpError(403, 'Forbidden');
  const questions = attempt.quiz.questions as unknown as QuizQuestion[];
  const projected = projectQuestionsForStudent(
    questions,
    attempt.questionOrder as number[],
    attempt.optionOrders as number[][],
  );
  const result = buildResult(
    { ...attempt.quiz, showAnswers: true },
    questions,
    attempt,
    projected,
  );
  res.json({ attempt: { ...result, student: attempt.student } });
}

