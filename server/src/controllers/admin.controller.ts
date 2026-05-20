import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../utils/HttpError.js';

function requireAdmin(req: Request) {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  if (req.user.role !== 'ADMIN') throw new HttpError(403, 'Admin only');
  return req.user;
}

export async function getStats(req: Request, res: Response): Promise<void> {
  requireAdmin(req);

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    usersByRole,
    disabledCount,
    classroomCount,
    assignmentCount,
    quizCount,
    eventCount,
    signups7,
    signups30,
    topClasses,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.user.count({ where: { disabledAt: { not: null } } }),
    prisma.classroom.count(),
    prisma.assignment.count(),
    prisma.quiz.count(),
    prisma.event.count(),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.classroom.findMany({
      orderBy: { enrolments: { _count: 'desc' } },
      take: 5,
      select: {
        id: true,
        name: true,
        teacher: { select: { id: true, name: true } },
        _count: { select: { enrolments: true } },
      },
    }),
  ]);

  const roleMap: Record<'STUDENT' | 'TEACHER' | 'ADMIN', number> = {
    STUDENT: 0,
    TEACHER: 0,
    ADMIN: 0,
  };
  for (const row of usersByRole) roleMap[row.role] = row._count._all;
  const totalUsers = roleMap.STUDENT + roleMap.TEACHER + roleMap.ADMIN;

  res.json({
    stats: {
      users: {
        total: totalUsers,
        students: roleMap.STUDENT,
        faculty: roleMap.TEACHER,
        admins: roleMap.ADMIN,
        disabled: disabledCount,
        signups7d: signups7,
        signups30d: signups30,
      },
      classrooms: classroomCount,
      assignments: assignmentCount,
      exams: quizCount,
      events: eventCount,
      topClasses: topClasses.map((c) => ({
        id: c.id,
        name: c.name,
        teacher: c.teacher,
        studentCount: c._count.enrolments,
      })),
    },
  });
}

export async function listAuditEvents(req: Request, res: Response): Promise<void> {
  requireAdmin(req);

  const limitRaw = Number(req.query.limit ?? 100);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.trunc(limitRaw))) : 100;

  const events = await prisma.auditEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      action: true,
      summary: true,
      targetType: true,
      targetId: true,
      metadata: true,
      createdAt: true,
      actor: { select: { id: true, name: true, email: true } },
      targetUser: { select: { id: true, name: true, email: true } },
    },
  });

  res.json({ events });
}

export async function adminListClassrooms(req: Request, res: Response): Promise<void> {
  requireAdmin(req);
  const classrooms = await prisma.classroom.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      code: true,
      createdAt: true,
      updatedAt: true,
      teacher: { select: { id: true, name: true, email: true } },
      _count: { select: { enrolments: true, assignments: true, quizzes: true } },
    },
  });
  res.json({ classrooms });
}
