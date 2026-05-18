import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../utils/HttpError.js';
import {
  ensureClassroomMember,
  ensureClassroomOwner,
  isOwnerOrAdmin,
} from '../utils/classroomAuth.js';
import {
  createAnnouncementSchema,
  parseYoutubeId,
  updateAnnouncementSchema,
} from '../schemas/announcement.schema.js';
import {
  announcementDocPath,
  announcementImagePath,
  safeUnlink,
  sanitizeDownloadName,
} from '../utils/uploads.js';
import { notifyClassroom, truncatePreview } from '../utils/notifications.js';

function requireUser(req: Request) {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  return req.user;
}

const attachmentSelect = {
  id: true,
  kind: true,
  filename: true,
  mimetype: true,
  size: true,
  youtubeId: true,
  youtubeUrl: true,
  url: true,
  title: true,
  host: true,
  createdAt: true,
} as const;

const commentSelect = {
  id: true,
  body: true,
  authorId: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true, email: true } },
} as const;

const announcementSelect = {
  id: true,
  classroomId: true,
  authorId: true,
  body: true,
  isPinned: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true, email: true } },
  attachments: { select: attachmentSelect, orderBy: { createdAt: 'asc' as const } },
  comments: { select: commentSelect, orderBy: { createdAt: 'asc' as const } },
} as const;

export async function createAnnouncement(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id: classroomId } = req.params as { id: string };
  await ensureClassroomOwner(user, classroomId);

  const data = createAnnouncementSchema.parse(req.body);
  const ytItems: { youtubeId: string; youtubeUrl: string }[] = [];
  for (const raw of data.youtubeUrls ?? []) {
    const id = parseYoutubeId(raw);
    if (!id) throw new HttpError(400, `Invalid YouTube URL: ${raw}`);
    ytItems.push({ youtubeId: id, youtubeUrl: raw });
  }

  const announcement = await prisma.announcement.create({
    data: {
      classroomId,
      authorId: user.id,
      body: data.body,
      isPinned: data.isPinned ?? false,
      attachments: ytItems.length
        ? { create: ytItems.map((y) => ({ kind: 'YOUTUBE', ...y })) }
        : undefined,
    },
    select: announcementSelect,
  });
  await notifyClassroom({
    classroomId,
    actorId: user.id,
    type: 'ANNOUNCEMENT_NEW',
    title: `New announcement in your class`,
    body: truncatePreview(announcement.body),
    announcementId: announcement.id,
  });
  res.status(201).json({ announcement });
}

export async function listAnnouncements(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id: classroomId } = req.params as { id: string };
  await ensureClassroomMember(user, classroomId);

  const takeRaw = Number(req.query.take ?? 10);
  const take = Number.isFinite(takeRaw) ? Math.max(1, Math.min(50, Math.trunc(takeRaw))) : 10;
  const skipRaw = Number(req.query.skip ?? 0);
  const skip = Number.isFinite(skipRaw) ? Math.max(0, Math.trunc(skipRaw)) : 0;

  const items = await prisma.announcement.findMany({
    where: { classroomId },
    orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    take: take + 1,
    skip,
    select: announcementSelect,
  });
  const hasMore = items.length > take;
  res.json({ announcements: items.slice(0, take), hasMore });
}

export async function getAnnouncement(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params as { id: string };
  const announcement = await prisma.announcement.findUnique({
    where: { id }, select: announcementSelect,
  });
  if (!announcement) throw new HttpError(404, 'Announcement not found');
  await ensureClassroomMember(user, announcement.classroomId);
  res.json({ announcement });
}

export async function updateAnnouncement(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params as { id: string };
  const existing = await prisma.announcement.findUnique({
    where: { id },
    select: { id: true, authorId: true, classroom: { select: { teacherId: true } } },
  });
  if (!existing) throw new HttpError(404, 'Announcement not found');
  if (!isOwnerOrAdmin(user, existing.classroom.teacherId) && user.id !== existing.authorId) {
    throw new HttpError(403, 'Forbidden');
  }
  const data = updateAnnouncementSchema.parse(req.body);
  const updated = await prisma.announcement.update({
    where: { id },
    data: {
      ...(data.body !== undefined ? { body: data.body } : {}),
      ...(data.isPinned !== undefined ? { isPinned: data.isPinned } : {}),
    },
    select: announcementSelect,
  });
  res.json({ announcement: updated });
}

export async function deleteAnnouncement(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params as { id: string };
  const existing = await prisma.announcement.findUnique({
    where: { id },
    select: {
      id: true, authorId: true,
      classroom: { select: { teacherId: true } },
      attachments: { select: { storedName: true, kind: true } },
    },
  });
  if (!existing) throw new HttpError(404, 'Announcement not found');
  if (!isOwnerOrAdmin(user, existing.classroom.teacherId) && user.id !== existing.authorId) {
    throw new HttpError(403, 'Forbidden');
  }
  await prisma.announcement.delete({ where: { id } });
  await Promise.all(
    existing.attachments
      .filter((a) => a.storedName && (a.kind === 'IMAGE' || a.kind === 'DOCUMENT'))
      .map((a) => safeUnlink(
        a.kind === 'IMAGE'
          ? announcementImagePath(a.storedName as string)
          : announcementDocPath(a.storedName as string),
      )),
  );
  res.status(204).end();
}
