import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../utils/HttpError.js';
import { ensureClassroomOwner } from '../utils/classroomAuth.js';

function requireUser(req: Request) {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  return req.user;
}

function pct(num: number, den: number): number {
  if (den <= 0) return 0;
  return Math.round((num / den) * 1000) / 10;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

export async function getClassroomInsights(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id: classroomId } = req.params as { id: string };
  await ensureClassroomOwner(user, classroomId);

  const [classroom, students, assignments, quizzes] = await Promise.all([
    prisma.classroom.findUnique({
      where: { id: classroomId },
      select: { id: true, name: true },
    }),
    prisma.enrolment.findMany({
      where: { classroomId },
      select: { student: { select: { id: true, name: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    }),
    prisma.assignment.findMany({
      where: { classroomId },
      select: {
        id: true, title: true, dueDate: true, createdAt: true,
        submissions: { select: { studentId: true, grade: true, isLate: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.quiz.findMany({
      where: { classroomId },
      select: {
        id: true, title: true, dueDate: true, totalPoints: true, createdAt: true,
        attempts: { select: { studentId: true, score: true, totalPoints: true, submittedAt: true, isLate: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  if (!classroom) throw new HttpError(404, 'Classroom not found');

  const studentList = students.map((e) => e.student);
  const total = studentList.length;

  const assignmentRows = assignments.map((a) => {
    const submitted = a.submissions.length;
    const grades = a.submissions.map((s) => s.grade).filter((g): g is number => g !== null);
    return {
      id: a.id,
      title: a.title,
      dueDate: a.dueDate,
      total,
      submitted,
      completionRate: pct(submitted, total),
      gradedCount: grades.length,
      avgGrade: avg(grades),
      lateCount: a.submissions.filter((s) => s.isLate).length,
    };
  });

  const quizRows = quizzes.map((q) => {
    const submittedAttempts = q.attempts.filter((a) => a.submittedAt !== null);
    const percents = submittedAttempts
      .filter((a) => a.score !== null && a.totalPoints > 0)
      .map((a) => ((a.score as number) / a.totalPoints) * 100);
    return {
      id: q.id,
      title: q.title,
      dueDate: q.dueDate,
      totalPoints: q.totalPoints,
      total,
      submitted: submittedAttempts.length,
      attemptRate: pct(submittedAttempts.length, total),
      avgPercent: avg(percents),
      lateCount: submittedAttempts.filter((a) => a.isLate).length,
    };
  });

  const studentRows = studentList.map((s) => {
    const subs = assignments.flatMap((a) =>
      a.submissions.filter((x) => x.studentId === s.id).map((x) => ({ a, x })),
    );
    const grades = subs.map(({ x }) => x.grade).filter((g): g is number => g !== null);
    const myAttempts = quizzes.flatMap((q) =>
      q.attempts.filter((x) => x.studentId === s.id && x.submittedAt !== null).map((x) => ({ q, x })),
    );
    const quizPercents = myAttempts
      .filter(({ x, q }) => x.score !== null && q.totalPoints > 0)
      .map(({ x, q }) => ((x.score as number) / q.totalPoints) * 100);
    const now = Date.now();
    const missingAssignments = assignments.filter(
      (a) => a.dueDate && a.dueDate.getTime() < now && !a.submissions.some((x) => x.studentId === s.id),
    ).length;
    const missingQuizzes = quizzes.filter(
      (q) => q.dueDate && q.dueDate.getTime() < now && !q.attempts.some((x) => x.studentId === s.id && x.submittedAt !== null),
    ).length;
    return {
      id: s.id,
      name: s.name,
      email: s.email,
      assignmentsSubmitted: subs.length,
      assignmentsTotal: assignments.length,
      gradedCount: grades.length,
      avgGrade: avg(grades),
      quizzesSubmitted: myAttempts.length,
      quizzesTotal: quizzes.length,
      avgQuizPercent: avg(quizPercents),
      missingCount: missingAssignments + missingQuizzes,
    };
  });

  const totals = {
    studentCount: total,
    assignmentsTotal: assignments.length,
    quizzesTotal: quizzes.length,
    avgCompletionRate: avg(assignmentRows.map((r) => r.completionRate)),
    avgQuizPercent: avg(quizRows.flatMap((r) => (r.submitted > 0 ? [r.avgPercent] : []))),
  };

  res.json({
    classroom: { id: classroom.id, name: classroom.name, studentCount: total },
    assignments: assignmentRows,
    quizzes: quizRows,
    students: studentRows,
    totals,
  });
}

export async function getMyInsights(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  if (user.role !== 'STUDENT') throw new HttpError(403, 'Students only');

  const enrolments = await prisma.enrolment.findMany({
    where: { studentId: user.id },
    select: {
      classroom: {
        select: {
          id: true,
          name: true,
          teacher: { select: { id: true, name: true } },
          assignments: {
            select: {
              id: true, dueDate: true,
              submissions: {
                where: { studentId: user.id },
                select: { id: true, grade: true, isLate: true },
              },
            },
          },
          quizzes: {
            select: {
              id: true, dueDate: true, totalPoints: true,
              attempts: {
                where: { studentId: user.id },
                select: { score: true, totalPoints: true, submittedAt: true, isLate: true },
              },
            },
          },
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  });

  const now = Date.now();

  const classes = enrolments.map((e) => {
    const c = e.classroom;
    const aTotal = c.assignments.length;
    const aSubs = c.assignments.flatMap((a) => a.submissions);
    const aGrades = aSubs.map((s) => s.grade).filter((g): g is number => g !== null);
    const qTotal = c.quizzes.length;
    const qAttempts = c.quizzes.flatMap((q) =>
      q.attempts.filter((a) => a.submittedAt !== null).map((a) => ({ q, a })),
    );
    const qPercents = qAttempts
      .filter(({ a, q }) => a.score !== null && q.totalPoints > 0)
      .map(({ a, q }) => ((a.score as number) / q.totalPoints) * 100);
    const pendingAssignments = c.assignments.filter((a) => a.submissions.length === 0).length;
    const pendingQuizzes = c.quizzes.filter(
      (q) => !q.attempts.some((x) => x.submittedAt !== null),
    ).length;
    const overdueAssignments = c.assignments.filter(
      (a) => a.dueDate && a.dueDate.getTime() < now && a.submissions.length === 0,
    ).length;
    const overdueQuizzes = c.quizzes.filter(
      (q) => q.dueDate && q.dueDate.getTime() < now && !q.attempts.some((x) => x.submittedAt !== null),
    ).length;
    return {
      classroomId: c.id,
      name: c.name,
      teacherName: c.teacher.name,
      assignmentsTotal: aTotal,
      assignmentsSubmitted: aSubs.length,
      gradedCount: aGrades.length,
      avgGrade: avg(aGrades),
      assignmentCompletionRate: pct(aSubs.length, aTotal),
      quizzesTotal: qTotal,
      quizzesSubmitted: qAttempts.length,
      avgQuizPercent: avg(qPercents),
      quizCompletionRate: pct(qAttempts.length, qTotal),
      pendingCount: pendingAssignments + pendingQuizzes,
      overdueCount: overdueAssignments + overdueQuizzes,
    };
  });

  const totals = {
    classes: classes.length,
    assignmentsTotal: classes.reduce((a, c) => a + c.assignmentsTotal, 0),
    assignmentsSubmitted: classes.reduce((a, c) => a + c.assignmentsSubmitted, 0),
    quizzesTotal: classes.reduce((a, c) => a + c.quizzesTotal, 0),
    quizzesSubmitted: classes.reduce((a, c) => a + c.quizzesSubmitted, 0),
    avgGrade: avg(classes.filter((c) => c.gradedCount > 0).map((c) => c.avgGrade)),
    avgQuizPercent: avg(classes.filter((c) => c.quizzesSubmitted > 0).map((c) => c.avgQuizPercent)),
    pendingCount: classes.reduce((a, c) => a + c.pendingCount, 0),
    overdueCount: classes.reduce((a, c) => a + c.overdueCount, 0),
  };

  res.json({ classes, totals });
}
