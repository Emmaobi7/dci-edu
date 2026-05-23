import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../utils/HttpError.js';
import {
  STUDENT_PROFILE_FIELDS,
  TEACHER_PROFILE_FIELDS,
  updateProfileSchema,
} from '../schemas/profile.schema.js';
import { toUserDto, userDtoSelect } from '../utils/userDto.js';
import { ensureClassroomOwner } from '../utils/classroomAuth.js';
import { persistUpload, removeStoredObject, streamStoredObject } from '../utils/uploads.js';

export async function getMyProfile(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: userDtoSelect,
  });
  if (!user) throw new HttpError(401, 'Not authenticated');
  res.json({ user: toUserDto(user) });
}

export async function updateMyProfile(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  if (req.user.role === 'ADMIN') {
    throw new HttpError(403, 'Admin profile editing is not supported here');
  }

  const patch = updateProfileSchema.parse(req.body);
  const allowed = new Set<string>(
    req.user.role === 'STUDENT' ? STUDENT_PROFILE_FIELDS : TEACHER_PROFILE_FIELDS,
  );

  // Build a Prisma update object containing only role-allowed fields explicitly provided.
  const data: Prisma.UserUpdateInput = {};
  for (const key of Object.keys(patch) as Array<keyof typeof patch>) {
    if (!allowed.has(key)) continue;
    const value = patch[key];
    if (value !== undefined) {
      (data as Record<string, string | null>)[key] = value;
    }
  }

  // For students: recompose display name from firstName + surname when either changes.
  if (
    req.user.role === 'STUDENT' &&
    (patch.firstName !== undefined || patch.surname !== undefined)
  ) {
    const current = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { firstName: true, surname: true, name: true },
    });
    if (!current) throw new HttpError(401, 'Not authenticated');
    const nextFirst = patch.firstName !== undefined ? patch.firstName : current.firstName;
    const nextSurname = patch.surname !== undefined ? patch.surname : current.surname;
    const composed = [nextFirst, nextSurname].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    if (composed.length > 0) {
      data.name = composed;
    }
  }

  // For teachers: name is edited directly; reject blanking it out.
  if (req.user.role === 'TEACHER' && patch.name !== undefined && patch.name === null) {
    throw new HttpError(400, 'Name cannot be empty');
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: userDtoSelect,
    });
    res.json({ user: toUserDto(user) });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'That matriculation number is already in use');
    }
    throw err;
  }
}

export async function uploadMyAvatar(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  if (!req.file) throw new HttpError(400, 'Avatar file is required');

  const previous = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { avatarStoredName: true },
  });

  const storedName = await persistUpload('avatars', req.file);

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { avatarStoredName: storedName, avatarMimetype: req.file.mimetype },
    select: userDtoSelect,
  });

  if (previous?.avatarStoredName && previous.avatarStoredName !== storedName) {
    await removeStoredObject('avatars', previous.avatarStoredName);
  }
  res.status(201).json({ user: toUserDto(user) });
}

export async function deleteMyAvatar(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  const previous = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { avatarStoredName: true },
  });
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { avatarStoredName: null, avatarMimetype: null },
    select: userDtoSelect,
  });
  if (previous?.avatarStoredName) await removeStoredObject('avatars', previous.avatarStoredName);
  res.json({ user: toUserDto(user) });
}

export async function getUserAvatar(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  const { userId } = req.params as { userId: string };
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarStoredName: true, avatarMimetype: true },
  });
  if (!target || !target.avatarStoredName) throw new HttpError(404, 'No avatar');
  res.setHeader('Cache-Control', 'private, max-age=300');
  try {
    await streamStoredObject(res, 'avatars', target.avatarStoredName, target.avatarMimetype ?? 'application/octet-stream');
  } catch (err) {
    // Stale DB reference (e.g. uploaded under in-memory storage before Supabase was configured).
    // Clear it so the UI stops requesting a non-existent object.
    // eslint-disable-next-line no-console
    console.warn('[avatar] missing in storage, clearing reference for user', userId, err instanceof Error ? err.message : err);
    await prisma.user.update({
      where: { id: userId },
      data: { avatarStoredName: null, avatarMimetype: null },
    }).catch(() => undefined);
    throw new HttpError(404, 'No avatar');
  }
}

export async function getClassroomStudentProfile(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  const { id: classroomId, studentId } = req.params as { id: string; studentId: string };
  if (!classroomId || !studentId) throw new HttpError(400, 'Missing parameters');

  // Only the classroom owner (teacher) or an admin can view a student's profile.
  await ensureClassroomOwner(req.user, classroomId);

  const enrolment = await prisma.enrolment.findUnique({
    where: { classroomId_studentId: { classroomId, studentId } },
    select: { id: true },
  });
  if (!enrolment) throw new HttpError(404, 'Student is not enrolled in this classroom');

  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: userDtoSelect,
  });
  if (!student || student.role !== 'STUDENT') throw new HttpError(404, 'Student not found');
  res.json({ user: toUserDto(student) });
}
