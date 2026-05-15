import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../utils/HttpError.js';

function requireUser(req: Request) {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  return req.user;
}

const notificationSelect = {
  id: true,
  type: true,
  title: true,
  body: true,
  classroomId: true,
  announcementId: true,
  assignmentId: true,
  quizId: true,
  readAt: true,
  createdAt: true,
  classroom: { select: { id: true, name: true } },
} as const;

export async function listNotifications(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const unreadOnly = req.query.unread === '1' || req.query.unread === 'true';
  const limitRaw = Number(req.query.limit ?? 30);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.trunc(limitRaw))) : 30;

  const where = {
    userId: user.id,
    ...(unreadOnly ? { readAt: null } : {}),
  };
  const notifications = await prisma.notification.findMany({
    where,
    orderBy: [{ readAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
    take: limit,
    select: notificationSelect,
  });
  res.json({ notifications });
}

export async function unreadCount(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const count = await prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });
  res.json({ count });
}

export async function markRead(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params as { id: string };
  const existing = await prisma.notification.findUnique({
    where: { id },
    select: { id: true, userId: true, readAt: true },
  });
  if (!existing || existing.userId !== user.id) throw new HttpError(404, 'Notification not found');
  if (existing.readAt) {
    res.json({ ok: true });
    return;
  }
  await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  res.json({ ok: true });
}

export async function markAllRead(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ ok: true });
}
