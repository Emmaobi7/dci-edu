import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../utils/HttpError.js';
import { loadChatRole } from '../utils/classroomAuth.js';
import { getIo, roomName } from '../socket/io.js';

function requireUser(req: Request) {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  return req.user;
}

async function loadEnrolment(classroomId: string, studentId: string) {
  const enrolment = await prisma.enrolment.findUnique({
    where: { classroomId_studentId: { classroomId, studentId } },
    select: { id: true, mutedAt: true },
  });
  if (!enrolment) throw new HttpError(404, 'Student is not enrolled');
  return enrolment;
}

export async function muteStudent(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id: classroomId, studentId } = req.params as { id: string; studentId: string };
  const role = await loadChatRole(user, classroomId);
  if (!role.isOwner && !role.isModerator) throw new HttpError(403, 'Forbidden');
  if (studentId === role.teacherId) throw new HttpError(400, 'Cannot mute the teacher');
  if (studentId === user.id) throw new HttpError(400, 'Cannot mute yourself');

  await loadEnrolment(classroomId, studentId);
  const updated = await prisma.enrolment.update({
    where: { classroomId_studentId: { classroomId, studentId } },
    data: { mutedAt: new Date() },
    select: { mutedAt: true },
  });
  getIo()?.to(roomName(classroomId)).emit('moderation:mute', {
    classroomId, studentId, mutedAt: updated.mutedAt, by: user.id,
  });
  res.json({ studentId, mutedAt: updated.mutedAt });
}

export async function unmuteStudent(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id: classroomId, studentId } = req.params as { id: string; studentId: string };
  const role = await loadChatRole(user, classroomId);
  if (!role.isOwner && !role.isModerator) throw new HttpError(403, 'Forbidden');

  await loadEnrolment(classroomId, studentId);
  await prisma.enrolment.update({
    where: { classroomId_studentId: { classroomId, studentId } },
    data: { mutedAt: null },
  });
  getIo()?.to(roomName(classroomId)).emit('moderation:unmute', {
    classroomId, studentId, by: user.id,
  });
  res.json({ studentId, mutedAt: null });
}

export async function promoteModerator(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  if (user.role !== 'ADMIN') throw new HttpError(403, 'Only administrators can promote moderators');
  const { id: classroomId, studentId } = req.params as { id: string; studentId: string };

  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: { id: true },
  });
  if (!classroom) throw new HttpError(404, 'Classroom not found');
  await loadEnrolment(classroomId, studentId);

  const updated = await prisma.classroom.update({
    where: { id: classroomId },
    data: { moderatorId: studentId },
    select: { moderatorId: true },
  });
  getIo()?.to(roomName(classroomId)).emit('moderation:promote', {
    classroomId, moderatorId: updated.moderatorId, by: user.id,
  });
  res.json({ classroomId, moderatorId: updated.moderatorId });
}

export async function demoteModerator(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  if (user.role !== 'ADMIN') throw new HttpError(403, 'Only administrators can demote moderators');
  const { id: classroomId } = req.params as { id: string };

  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: { id: true },
  });
  if (!classroom) throw new HttpError(404, 'Classroom not found');

  const updated = await prisma.classroom.update({
    where: { id: classroomId },
    data: { moderatorId: null },
    select: { moderatorId: true },
  });
  getIo()?.to(roomName(classroomId)).emit('moderation:demote', {
    classroomId, by: user.id,
  });
  res.json({ classroomId, moderatorId: updated.moderatorId });
}
