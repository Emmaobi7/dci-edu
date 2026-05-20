import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../utils/HttpError.js';
import { generateUniqueClassCode } from '../utils/classCode.js';
import {
  createClassroomSchema,
  updateClassroomSchema,
} from '../schemas/classroom.schema.js';
import { writeAudit } from '../utils/audit.js';

const classroomPublicSelect = {
  id: true,
  name: true,
  description: true,
  code: true,
  teacherId: true,
  moderatorId: true,
  createdAt: true,
  updatedAt: true,
  teacher: { select: { id: true, name: true, email: true } },
} as const;

function requireUser(req: Request) {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  return req.user;
}

async function loadClassroomOrThrow(id: string) {
  const c = await prisma.classroom.findUnique({ where: { id }, select: classroomPublicSelect });
  if (!c) throw new HttpError(404, 'Classroom not found');
  return c;
}

function isOwnerOrAdmin(user: { id: string; role: 'ADMIN' | 'TEACHER' | 'STUDENT' }, teacherId: string) {
  return user.role === 'ADMIN' || user.id === teacherId;
}

export async function createClassroom(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  if (user.role !== 'TEACHER' && user.role !== 'ADMIN') {
    throw new HttpError(403, 'Only teachers can create classrooms');
  }
  const { name, description } = createClassroomSchema.parse(req.body);
  const code = await generateUniqueClassCode();
  const classroom = await prisma.classroom.create({
    data: { name, description, code, teacherId: user.id },
    select: classroomPublicSelect,
  });
  res.status(201).json({ classroom });
}

export async function listClassrooms(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);

  if (user.role === 'ADMIN') {
    const classrooms = await prisma.classroom.findMany({
      orderBy: { createdAt: 'desc' },
      select: { ...classroomPublicSelect, _count: { select: { enrolments: true } } },
    });
    res.json({ classrooms });
    return;
  }

  if (user.role === 'TEACHER') {
    const classrooms = await prisma.classroom.findMany({
      where: { teacherId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { ...classroomPublicSelect, _count: { select: { enrolments: true } } },
    });
    res.json({ classrooms });
    return;
  }

  // STUDENT — only enrolled
  const enrolments = await prisma.enrolment.findMany({
    where: { studentId: user.id },
    orderBy: { joinedAt: 'desc' },
    select: {
      joinedAt: true,
      classroom: { select: { ...classroomPublicSelect, _count: { select: { enrolments: true } } } },
    },
  });
  res.json({ classrooms: enrolments.map((e) => ({ ...e.classroom, joinedAt: e.joinedAt })) });
}

export async function getClassroom(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params as { id: string };
  const classroom = await loadClassroomOrThrow(id);

  const isMember =
    isOwnerOrAdmin(user, classroom.teacherId) ||
    (await prisma.enrolment.findUnique({
      where: { classroomId_studentId: { classroomId: id, studentId: user.id } },
      select: { id: true },
    }));

  if (!isMember) throw new HttpError(403, 'Not a member of this classroom');

  const studentCount = await prisma.enrolment.count({ where: { classroomId: id } });
  // Hide the join code from non-owner students
  const payload = isOwnerOrAdmin(user, classroom.teacherId)
    ? classroom
    : { ...classroom, code: undefined };

  res.json({ classroom: { ...payload, studentCount } });
}

export async function updateClassroom(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params as { id: string };
  const classroom = await loadClassroomOrThrow(id);
  if (!isOwnerOrAdmin(user, classroom.teacherId)) throw new HttpError(403, 'Forbidden');

  const data = updateClassroomSchema.parse(req.body);
  const updated = await prisma.classroom.update({
    where: { id },
    data,
    select: classroomPublicSelect,
  });
  res.json({ classroom: updated });
}

export async function deleteClassroom(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params as { id: string };
  const classroom = await loadClassroomOrThrow(id);
  if (!isOwnerOrAdmin(user, classroom.teacherId)) throw new HttpError(403, 'Forbidden');

  await prisma.classroom.delete({ where: { id } });

  await writeAudit({
    action: 'CLASSROOM_DELETED',
    actorId: user.id,
    targetType: 'Classroom',
    targetId: id,
    summary: `Deleted class "${classroom.name}" (${classroom.code})`,
    metadata: { name: classroom.name, code: classroom.code, teacherId: classroom.teacherId },
  });

  res.status(204).end();
}

export async function regenerateCode(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params as { id: string };
  const classroom = await loadClassroomOrThrow(id);
  if (!isOwnerOrAdmin(user, classroom.teacherId)) throw new HttpError(403, 'Forbidden');

  const code = await generateUniqueClassCode();
  const updated = await prisma.classroom.update({
    where: { id },
    data: { code },
    select: classroomPublicSelect,
  });
  res.json({ classroom: updated });
}
