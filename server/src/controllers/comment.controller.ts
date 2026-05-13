import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../utils/HttpError.js';
import { ensureClassroomMember, isOwnerOrAdmin } from '../utils/classroomAuth.js';
import { commentSchema } from '../schemas/announcement.schema.js';

function requireUser(req: Request) {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  return req.user;
}

const commentSelect = {
  id: true,
  body: true,
  authorId: true,
  announcementId: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true, email: true } },
} as const;

export async function createComment(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id: announcementId } = req.params as { id: string };
  const announcement = await prisma.announcement.findUnique({
    where: { id: announcementId },
    select: { id: true, classroomId: true },
  });
  if (!announcement) throw new HttpError(404, 'Announcement not found');
  await ensureClassroomMember(user, announcement.classroomId);
  const data = commentSchema.parse(req.body);
  const comment = await prisma.announcementComment.create({
    data: { announcementId, authorId: user.id, body: data.body },
    select: commentSelect,
  });
  res.status(201).json({ comment });
}

export async function updateComment(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params as { id: string };
  const existing = await prisma.announcementComment.findUnique({
    where: { id },
    select: {
      id: true, authorId: true,
      announcement: { select: { classroom: { select: { teacherId: true } } } },
    },
  });
  if (!existing) throw new HttpError(404, 'Comment not found');
  if (user.id !== existing.authorId && !isOwnerOrAdmin(user, existing.announcement.classroom.teacherId)) {
    throw new HttpError(403, 'Forbidden');
  }
  const data = commentSchema.parse(req.body);
  const comment = await prisma.announcementComment.update({
    where: { id }, data: { body: data.body }, select: commentSelect,
  });
  res.json({ comment });
}

export async function deleteComment(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params as { id: string };
  const existing = await prisma.announcementComment.findUnique({
    where: { id },
    select: {
      id: true, authorId: true,
      announcement: { select: { classroom: { select: { teacherId: true } } } },
    },
  });
  if (!existing) throw new HttpError(404, 'Comment not found');
  if (user.id !== existing.authorId && !isOwnerOrAdmin(user, existing.announcement.classroom.teacherId)) {
    throw new HttpError(403, 'Forbidden');
  }
  await prisma.announcementComment.delete({ where: { id } });
  res.status(204).end();
}
