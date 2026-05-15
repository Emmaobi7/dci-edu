import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../utils/HttpError.js';
import { loadChatRole } from '../utils/classroomAuth.js';
import { getIo, messageSelect, roomName } from '../socket/io.js';

function requireUser(req: Request) {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  return req.user;
}

export async function listMessages(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id: classroomId } = req.params as { id: string };
  await loadChatRole(user, classroomId);

  const limitRaw = Number(req.query.limit ?? 50);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.trunc(limitRaw))) : 50;
  const before = typeof req.query.before === 'string' ? req.query.before : null;

  const where = {
    classroomId,
    ...(before ? { createdAt: { lt: new Date(before) } } : {}),
  };
  const rows = await prisma.message.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: messageSelect,
  });
  // Return in chronological order
  res.json({ messages: rows.reverse(), hasMore: rows.length === limit });
}

export async function deleteMessage(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id: messageId } = req.params as { id: string };

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, classroomId: true, senderId: true, deletedAt: true },
  });
  if (!message) throw new HttpError(404, 'Message not found');
  if (message.deletedAt) {
    res.status(204).end();
    return;
  }

  const role = await loadChatRole(user, message.classroomId);
  const isAuthor = message.senderId === user.id;
  if (!isAuthor && !role.isOwner && !role.isModerator) {
    throw new HttpError(403, 'Cannot delete this message');
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { deletedAt: new Date(), deletedById: user.id },
    select: messageSelect,
  });

  getIo()?.to(roomName(message.classroomId)).emit('message:deleted', { message: updated });
  res.json({ message: updated });
}
