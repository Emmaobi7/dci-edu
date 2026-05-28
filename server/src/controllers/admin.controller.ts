import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../utils/HttpError.js';
import { toCsv } from '../utils/csv.js';

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

export async function exportClassroomsCsv(req: Request, res: Response): Promise<void> {
  requireAdmin(req);
  const classrooms = await prisma.classroom.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      name: true,
      code: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      teacher: { select: { name: true, email: true } },
      _count: { select: { enrolments: true, assignments: true, quizzes: true } },
    },
  });

  const header = [
    'name', 'code', 'description',
    'facultyName', 'facultyEmail',
    'students', 'assignments', 'exams',
    'createdAt', 'updatedAt',
  ];
  const rows: (string | number | null)[][] = [header];
  for (const c of classrooms) {
    rows.push([
      c.name,
      c.code,
      c.description ?? '',
      c.teacher.name,
      c.teacher.email,
      c._count.enrolments,
      c._count.assignments,
      c._count.quizzes,
      c.createdAt.toISOString(),
      c.updatedAt.toISOString(),
    ]);
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="classrooms.csv"');
  res.send(toCsv(rows));
}

export async function exportAuditCsv(req: Request, res: Response): Promise<void> {
  requireAdmin(req);
  const events = await prisma.auditEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10000,
    select: {
      action: true,
      summary: true,
      targetType: true,
      targetId: true,
      metadata: true,
      createdAt: true,
      actor: { select: { name: true, email: true } },
      targetUser: { select: { name: true, email: true } },
    },
  });

  const header = [
    'createdAt', 'action', 'summary',
    'actorName', 'actorEmail',
    'targetType', 'targetId', 'targetUserName', 'targetUserEmail',
    'metadata',
  ];
  const rows: (string | null)[][] = [header];
  for (const e of events) {
    rows.push([
      e.createdAt.toISOString(),
      e.action,
      e.summary,
      e.actor?.name ?? '',
      e.actor?.email ?? '',
      e.targetType ?? '',
      e.targetId ?? '',
      e.targetUser?.name ?? '',
      e.targetUser?.email ?? '',
      e.metadata == null ? '' : JSON.stringify(e.metadata),
    ]);
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="audit-log.csv"');
  res.send(toCsv(rows));
}
