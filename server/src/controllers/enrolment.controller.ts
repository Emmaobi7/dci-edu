import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../utils/HttpError.js';
import { joinByCodeSchema } from '../schemas/classroom.schema.js';

function requireUser(req: Request) {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  return req.user;
}

function isOwnerOrAdmin(user: { id: string; role: 'ADMIN' | 'TEACHER' | 'STUDENT' }, teacherId: string) {
  return user.role === 'ADMIN' || user.id === teacherId;
}

export async function joinByCode(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  if (user.role !== 'STUDENT') throw new HttpError(403, 'Only students can join classrooms');

  const { code } = joinByCodeSchema.parse(req.body);
  const classroom = await prisma.classroom.findUnique({
    where: { code },
    select: { id: true, name: true, teacherId: true },
  });
  if (!classroom) throw new HttpError(404, 'Invalid class code');

  const existing = await prisma.enrolment.findUnique({
    where: { classroomId_studentId: { classroomId: classroom.id, studentId: user.id } },
    select: { id: true },
  });
  if (existing) throw new HttpError(409, 'Already enrolled in this classroom');

  const enrolment = await prisma.enrolment.create({
    data: { classroomId: classroom.id, studentId: user.id },
    select: {
      id: true,
      joinedAt: true,
      classroom: { select: { id: true, name: true, description: true } },
    },
  });
  res.status(201).json({ enrolment });
}

export async function leaveClassroom(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { classroomId } = req.params as { classroomId: string };

  const enrolment = await prisma.enrolment.findUnique({
    where: { classroomId_studentId: { classroomId, studentId: user.id } },
    select: { id: true },
  });
  if (!enrolment) throw new HttpError(404, 'Not enrolled in this classroom');

  await prisma.enrolment.delete({ where: { id: enrolment.id } });
  res.status(204).end();
}

export async function listStudents(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params as { id: string };

  const classroom = await prisma.classroom.findUnique({
    where: { id },
    select: { id: true, teacherId: true },
  });
  if (!classroom) throw new HttpError(404, 'Classroom not found');
  if (!isOwnerOrAdmin(user, classroom.teacherId)) throw new HttpError(403, 'Forbidden');

  const enrolments = await prisma.enrolment.findMany({
    where: { classroomId: id },
    orderBy: { joinedAt: 'asc' },
    select: {
      id: true,
      joinedAt: true,
      student: { select: { id: true, name: true, email: true } },
    },
  });
  res.json({ students: enrolments });
}

export async function removeStudent(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id, studentId } = req.params as { id: string; studentId: string };

  const classroom = await prisma.classroom.findUnique({
    where: { id },
    select: { id: true, teacherId: true },
  });
  if (!classroom) throw new HttpError(404, 'Classroom not found');
  if (!isOwnerOrAdmin(user, classroom.teacherId)) throw new HttpError(403, 'Forbidden');

  const enrolment = await prisma.enrolment.findUnique({
    where: { classroomId_studentId: { classroomId: id, studentId } },
    select: { id: true },
  });
  if (!enrolment) throw new HttpError(404, 'Student is not enrolled');

  await prisma.enrolment.delete({ where: { id: enrolment.id } });
  res.status(204).end();
}
