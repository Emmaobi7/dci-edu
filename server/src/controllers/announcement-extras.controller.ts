import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../utils/HttpError.js';
import { ensureClassroomMember, isOwnerOrAdmin } from '../utils/classroomAuth.js';
import {
  addLinkSchema,
  addYoutubeSchema,
  commentSchema,
  normalizeLink,
  parseYoutubeId,
} from '../schemas/announcement.schema.js';
import {
  persistUpload,
  removeStoredObject,
  sanitizeDownloadName,
  streamStoredObject,
} from '../utils/uploads.js';

function requireUser(req: Request) {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  return req.user;
}

const attachmentPublic = {
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

const commentPublic = {
  id: true,
  body: true,
  authorId: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true, email: true } },
} as const;

async function loadAnnouncementForWrite(announcementId: string) {
  const a = await prisma.announcement.findUnique({
    where: { id: announcementId },
    select: {
      id: true, authorId: true, classroomId: true,
      classroom: { select: { teacherId: true } },
    },
  });
  if (!a) throw new HttpError(404, 'Announcement not found');
  return a;
}

export async function uploadImages(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params as { id: string };
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];

  const a = await prisma.announcement.findUnique({
    where: { id },
    select: { id: true, authorId: true, classroom: { select: { teacherId: true } } },
  });
  if (!a) throw new HttpError(404, 'Announcement not found');
  if (!isOwnerOrAdmin(user, a.classroom.teacherId) && user.id !== a.authorId) {
    throw new HttpError(403, 'Forbidden');
  }
  if (files.length === 0) throw new HttpError(400, 'No files uploaded');

  const stored = await Promise.all(
    files.map(async (f) => ({ file: f, storedName: await persistUpload('announcement-images', f) })),
  );

  const created = await prisma.$transaction(
    stored.map(({ file: f, storedName }) =>
      prisma.announcementAttachment.create({
        data: {
          announcementId: id,
          kind: 'IMAGE',
          filename: f.originalname,
          storedName,
          mimetype: f.mimetype,
          size: f.size,
        },
        select: attachmentPublic,
      }),
    ),
  );
  res.status(201).json({ attachments: created });
}

export async function addYoutube(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params as { id: string };
  const a = await loadAnnouncementForWrite(id);
  if (!isOwnerOrAdmin(user, a.classroom.teacherId) && user.id !== a.authorId) {
    throw new HttpError(403, 'Forbidden');
  }
  const data = addYoutubeSchema.parse(req.body);
  const ytId = parseYoutubeId(data.url);
  if (!ytId) throw new HttpError(400, 'Invalid YouTube URL');
  const attachment = await prisma.announcementAttachment.create({
    data: { announcementId: id, kind: 'YOUTUBE', youtubeId: ytId, youtubeUrl: data.url },
    select: attachmentPublic,
  });
  res.status(201).json({ attachment });
}

export async function uploadDocuments(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params as { id: string };
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];

  const a = await prisma.announcement.findUnique({
    where: { id },
    select: { id: true, authorId: true, classroom: { select: { teacherId: true } } },
  });
  if (!a) throw new HttpError(404, 'Announcement not found');
  if (!isOwnerOrAdmin(user, a.classroom.teacherId) && user.id !== a.authorId) {
    throw new HttpError(403, 'Forbidden');
  }
  if (files.length === 0) throw new HttpError(400, 'No files uploaded');

  const stored = await Promise.all(
    files.map(async (f) => ({ file: f, storedName: await persistUpload('announcement-docs', f) })),
  );

  const created = await prisma.$transaction(
    stored.map(({ file: f, storedName }) =>
      prisma.announcementAttachment.create({
        data: {
          announcementId: id,
          kind: 'DOCUMENT',
          filename: f.originalname,
          storedName,
          mimetype: f.mimetype,
          size: f.size,
        },
        select: attachmentPublic,
      }),
    ),
  );
  res.status(201).json({ attachments: created });
}

export async function addLink(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params as { id: string };
  const a = await loadAnnouncementForWrite(id);
  if (!isOwnerOrAdmin(user, a.classroom.teacherId) && user.id !== a.authorId) {
    throw new HttpError(403, 'Forbidden');
  }
  const data = addLinkSchema.parse(req.body);

  // If the user pasted a YouTube URL here, file it under YOUTUBE so it embeds.
  const ytId = parseYoutubeId(data.url);
  if (ytId) {
    const attachment = await prisma.announcementAttachment.create({
      data: { announcementId: id, kind: 'YOUTUBE', youtubeId: ytId, youtubeUrl: data.url },
      select: attachmentPublic,
    });
    res.status(201).json({ attachment });
    return;
  }

  const normalized = normalizeLink(data.url);
  if (!normalized) throw new HttpError(400, 'Invalid URL');
  const attachment = await prisma.announcementAttachment.create({
    data: {
      announcementId: id,
      kind: 'LINK',
      url: normalized.url,
      host: normalized.host,
      title: data.title?.trim() ? data.title.trim() : null,
    },
    select: attachmentPublic,
  });
  res.status(201).json({ attachment });
}

export async function deleteAttachment(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { attachmentId } = req.params as { attachmentId: string };
  const att = await prisma.announcementAttachment.findUnique({
    where: { id: attachmentId },
    select: {
      id: true, kind: true, storedName: true,
      announcement: { select: { authorId: true, classroom: { select: { teacherId: true } } } },
    },
  });
  if (!att) throw new HttpError(404, 'Attachment not found');
  const ann = att.announcement;
  if (!isOwnerOrAdmin(user, ann.classroom.teacherId) && user.id !== ann.authorId) {
    throw new HttpError(403, 'Forbidden');
  }
  await prisma.announcementAttachment.delete({ where: { id: attachmentId } });
  if (att.storedName) {
    if (att.kind === 'IMAGE') {
      await removeStoredObject('announcement-images', att.storedName);
    } else if (att.kind === 'DOCUMENT') {
      await removeStoredObject('announcement-docs', att.storedName);
    }
  }
  res.status(204).end();
}

export async function downloadAttachment(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { attachmentId } = req.params as { attachmentId: string };
  const att = await prisma.announcementAttachment.findUnique({
    where: { id: attachmentId },
    select: {
      kind: true, filename: true, storedName: true, mimetype: true,
      announcement: { select: { classroomId: true } },
    },
  });
  if (!att) throw new HttpError(404, 'Attachment not found');
  if (!att.storedName || (att.kind !== 'IMAGE' && att.kind !== 'DOCUMENT')) {
    throw new HttpError(400, 'Attachment has no downloadable file');
  }
  await ensureClassroomMember(user, att.announcement.classroomId);

  const disposition = att.kind === 'IMAGE' ? 'inline' : 'attachment';
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="${sanitizeDownloadName(att.filename ?? 'file')}"`,
  );
  await streamStoredObject(
    res,
    att.kind === 'IMAGE' ? 'announcement-images' : 'announcement-docs',
    att.storedName,
    att.mimetype ?? 'application/octet-stream',
  );
}
