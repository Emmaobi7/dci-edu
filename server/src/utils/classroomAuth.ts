import { prisma } from '../db/prisma.js';
import { HttpError } from './HttpError.js';
import type { AuthedUser } from '../middleware/auth.js';

export function isOwnerOrAdmin(user: AuthedUser, teacherId: string): boolean {
  return user.role === 'ADMIN' || user.id === teacherId;
}

export async function ensureClassroomMember(
  user: AuthedUser,
  classroomId: string,
): Promise<{ teacherId: string; isOwner: boolean }> {
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: { id: true, teacherId: true },
  });
  if (!classroom) throw new HttpError(404, 'Classroom not found');
  if (isOwnerOrAdmin(user, classroom.teacherId)) {
    return { teacherId: classroom.teacherId, isOwner: true };
  }
  const enrolment = await prisma.enrolment.findUnique({
    where: { classroomId_studentId: { classroomId, studentId: user.id } },
    select: { id: true },
  });
  if (!enrolment) throw new HttpError(403, 'Not a member of this classroom');
  return { teacherId: classroom.teacherId, isOwner: false };
}

export async function ensureClassroomOwner(
  user: AuthedUser,
  classroomId: string,
): Promise<{ teacherId: string }> {
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: { id: true, teacherId: true },
  });
  if (!classroom) throw new HttpError(404, 'Classroom not found');
  if (!isOwnerOrAdmin(user, classroom.teacherId)) throw new HttpError(403, 'Forbidden');
  return { teacherId: classroom.teacherId };
}
