import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../utils/HttpError.js';
import {
  addResourceLinkSchema,
  addResourceYoutubeSchema,
  createResourceSchema,
  listResourcesQuerySchema,
  updateResourceSchema,
} from '../schemas/resource.schema.js';
import { normalizeLink, parseYoutubeId } from '../schemas/announcement.schema.js';
import {
  persistUpload,
  removeStoredObject,
  sanitizeDownloadName,
  streamStoredObject,
} from '../utils/uploads.js';
import { writeAudit } from '../utils/audit.js';

function requireUser(req: Request) {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  return req.user;
}

function requireFacultyOrAdmin(req: Request) {
  const user = requireUser(req);
  if (user.role !== 'TEACHER' && user.role !== 'ADMIN') {
    throw new HttpError(403, 'Only faculty or admins can manage resources');
  }
  return user;
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

const resourcePublic = {
  id: true,
  title: true,
  description: true,
  category: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true, email: true, role: true } },
  attachments: { select: attachmentPublic, orderBy: { createdAt: 'asc' } as const },
} as const;

async function loadForWrite(req: Request, resourceId: string) {
  const user = requireUser(req);
  const r = await prisma.resource.findUnique({
    where: { id: resourceId },
    select: { id: true, createdById: true },
  });
  if (!r) throw new HttpError(404, 'Resource not found');
  if (user.role !== 'ADMIN' && user.id !== r.createdById) {
    throw new HttpError(403, 'Forbidden');
  }
  return { user, resource: r };
}

export async function listResources(req: Request, res: Response): Promise<void> {
  requireUser(req);
  const { q, category } = listResourcesQuerySchema.parse(req.query);
  const where: Prisma.ResourceWhereInput = {};
  if (category) where.category = category;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { category: { contains: q, mode: 'insensitive' } },
    ];
  }
  const resources = await prisma.resource.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: resourcePublic,
  });
  const categories = await prisma.resource.findMany({
    where: { category: { not: null } },
    distinct: ['category'],
    select: { category: true },
    orderBy: { category: 'asc' },
  });
  res.json({
    resources,
    categories: categories.map((c) => c.category).filter((c): c is string => !!c),
  });
}

export async function getResource(req: Request, res: Response): Promise<void> {
  requireUser(req);
  const { id } = req.params as { id: string };
  const resource = await prisma.resource.findUnique({
    where: { id },
    select: resourcePublic,
  });
  if (!resource) throw new HttpError(404, 'Resource not found');
  res.json({ resource });
}

export async function createResource(req: Request, res: Response): Promise<void> {
  const user = requireFacultyOrAdmin(req);
  const data = createResourceSchema.parse(req.body);
  const resource = await prisma.resource.create({
    data: {
      title: data.title,
      description: data.description?.trim() || null,
      category: data.category?.trim() || null,
      createdById: user.id,
    },
    select: resourcePublic,
  });
  await writeAudit({
    action: 'RESOURCE_CREATED',
    actorId: user.id,
    summary: `Created resource "${resource.title}"`,
    targetType: 'Resource',
    targetId: resource.id,
  });
  res.status(201).json({ resource });
}

export async function updateResource(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  await loadForWrite(req, id);
  const data = updateResourceSchema.parse(req.body);
  const resource = await prisma.resource.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description === undefined ? undefined : (data.description?.trim() || null),
      category: data.category === undefined ? undefined : (data.category?.trim() || null),
    },
    select: resourcePublic,
  });
  res.json({ resource });
}

export async function deleteResource(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const { user } = await loadForWrite(req, id);
  const attachments = await prisma.resourceAttachment.findMany({
    where: { resourceId: id, kind: 'DOCUMENT' },
    select: { storedName: true },
  });
  const target = await prisma.resource.findUnique({ where: { id }, select: { title: true } });
  await prisma.resource.delete({ where: { id } });
  await Promise.all(
    attachments.map((a) => (a.storedName ? removeStoredObject('resource-docs', a.storedName) : Promise.resolve())),
  );
  await writeAudit({
    action: 'RESOURCE_DELETED',
    actorId: user.id,
    summary: `Deleted resource "${target?.title ?? id}"`,
    targetType: 'Resource',
    targetId: id,
  });
  res.status(204).end();
}

export async function uploadDocuments(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  await loadForWrite(req, id);
  if (files.length === 0) throw new HttpError(400, 'No files uploaded');
  const stored = await Promise.all(
    files.map(async (f) => ({ file: f, storedName: await persistUpload('resource-docs', f) })),
  );
  const created = await prisma.$transaction(
    stored.map(({ file: f, storedName }) =>
      prisma.resourceAttachment.create({
        data: {
          resourceId: id,
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

export async function addYoutube(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  await loadForWrite(req, id);
  const data = addResourceYoutubeSchema.parse(req.body);
  const ytId = parseYoutubeId(data.url);
  if (!ytId) throw new HttpError(400, 'Invalid YouTube URL');
  const attachment = await prisma.resourceAttachment.create({
    data: { resourceId: id, kind: 'YOUTUBE', youtubeId: ytId, youtubeUrl: data.url },
    select: attachmentPublic,
  });
  res.status(201).json({ attachment });
}

export async function addLink(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  await loadForWrite(req, id);
  const data = addResourceLinkSchema.parse(req.body);

  const ytId = parseYoutubeId(data.url);
  if (ytId) {
    const attachment = await prisma.resourceAttachment.create({
      data: { resourceId: id, kind: 'YOUTUBE', youtubeId: ytId, youtubeUrl: data.url },
      select: attachmentPublic,
    });
    res.status(201).json({ attachment });
    return;
  }

  const normalized = normalizeLink(data.url);
  if (!normalized) throw new HttpError(400, 'Invalid URL');
  const attachment = await prisma.resourceAttachment.create({
    data: {
      resourceId: id,
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
  const att = await prisma.resourceAttachment.findUnique({
    where: { id: attachmentId },
    select: {
      id: true, kind: true, storedName: true,
      resource: { select: { createdById: true } },
    },
  });
  if (!att) throw new HttpError(404, 'Attachment not found');
  if (user.role !== 'ADMIN' && user.id !== att.resource.createdById) {
    throw new HttpError(403, 'Forbidden');
  }
  await prisma.resourceAttachment.delete({ where: { id: attachmentId } });
  if (att.kind === 'DOCUMENT' && att.storedName) {
    await removeStoredObject('resource-docs', att.storedName);
  }
  res.status(204).end();
}

export async function downloadAttachment(req: Request, res: Response): Promise<void> {
  requireUser(req);
  const { attachmentId } = req.params as { attachmentId: string };
  const att = await prisma.resourceAttachment.findUnique({
    where: { id: attachmentId },
    select: { kind: true, filename: true, storedName: true, mimetype: true },
  });
  if (!att) throw new HttpError(404, 'Attachment not found');
  if (att.kind !== 'DOCUMENT' || !att.storedName) {
    throw new HttpError(400, 'Attachment has no downloadable file');
  }
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${sanitizeDownloadName(att.filename ?? 'file')}"`,
  );
  await streamStoredObject(res, 'resource-docs', att.storedName, att.mimetype ?? 'application/octet-stream');
}
