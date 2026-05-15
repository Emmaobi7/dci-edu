import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../utils/HttpError.js';
import {
  ensureClassroomMember,
  ensureClassroomOwner,
  isOwnerOrAdmin,
} from '../utils/classroomAuth.js';
import {
  createAssignmentSchema,
  updateAssignmentSchema,
} from '../schemas/assignment.schema.js';
import {
  attachmentPath,
  safeUnlink,
  sanitizeDownloadName,
} from '../utils/uploads.js';
import { notifyClassroom, truncatePreview } from '../utils/notifications.js';

function requireUser(req: Request) {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  return req.user;
}

const assignmentSelect = {
  id: true,
  title: true,
  description: true,
  dueDate: true,
  classroomId: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  attachments: {
    select: { id: true, filename: true, mimetype: true, size: true, createdAt: true },
    orderBy: { createdAt: 'asc' as const },
  },
  createdBy: { select: { id: true, name: true, email: true } },
} as const;

export async function createAssignment(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id: classroomId } = req.params as { id: string };
  await ensureClassroomOwner(user, classroomId);

  const data = createAssignmentSchema.parse(req.body);
  const assignment = await prisma.assignment.create({
    data: {
      title: data.title,
      description: data.description,
      dueDate: data.dueDate,
      classroomId,
      createdById: user.id,
    },
    select: assignmentSelect,
  });
  await notifyClassroom({
    classroomId,
    actorId: user.id,
    type: 'ASSIGNMENT_NEW',
    title: `New assignment: ${assignment.title}`,
    body: assignment.description ? truncatePreview(assignment.description) : null,
    assignmentId: assignment.id,
  });
  res.status(201).json({ assignment });
}

export async function listMyUpcoming(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  if (user.role !== 'STUDENT') throw new HttpError(403, 'Students only');

  const limitRaw = Number(req.query.limit ?? 5);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(20, Math.trunc(limitRaw))) : 5;

  const where = {
    classroom: { enrolments: { some: { studentId: user.id } } },
    submissions: { none: { studentId: user.id } },
  } as const;

  const [items, totalPending] = await Promise.all([
    prisma.assignment.findMany({
      where,
      orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        title: true,
        dueDate: true,
        classroomId: true,
        createdAt: true,
        classroom: { select: { id: true, name: true } },
      },
    }),
    prisma.assignment.count({ where }),
  ]);

  res.json({ assignments: items, totalPending });
}

export async function listAssignments(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id: classroomId } = req.params as { id: string };
  const { isOwner } = await ensureClassroomMember(user, classroomId);

  const assignments = await prisma.assignment.findMany({
    where: { classroomId },
    orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    select: {
      ...assignmentSelect,
      _count: { select: { submissions: true } },
      ...(isOwner
        ? {}
        : {
            submissions: {
              where: { studentId: user.id },
              select: { id: true, grade: true, feedback: true, gradedAt: true, isLate: true, submittedAt: true },
            },
          }),
    },
  });

  if (isOwner) {
    res.json({ assignments });
    return;
  }

  const payload = assignments.map((a) => {
    const submissions = (a as unknown as { submissions: unknown[] }).submissions ?? [];
    const mine = submissions[0] ?? null;
    const { submissions: _drop, ...rest } = a as unknown as { submissions: unknown[] } & typeof a;
    void _drop;
    return { ...rest, mySubmission: mine };
  });
  res.json({ assignments: payload });
}

export async function getAssignment(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params as { id: string };

  const assignment = await prisma.assignment.findUnique({
    where: { id },
    select: assignmentSelect,
  });
  if (!assignment) throw new HttpError(404, 'Assignment not found');
  const { isOwner } = await ensureClassroomMember(user, assignment.classroomId);

  let extra: Record<string, unknown> = {};
  if (isOwner) {
    const submissionCount = await prisma.submission.count({ where: { assignmentId: id } });
    extra = { submissionCount };
  } else {
    const mine = await prisma.submission.findUnique({
      where: { assignmentId_studentId: { assignmentId: id, studentId: user.id } },
      select: {
        id: true, filename: true, mimetype: true, size: true,
        isLate: true, submittedAt: true, updatedAt: true,
        grade: true, feedback: true, gradedAt: true,
      },
    });
    extra = { mySubmission: mine };
  }
  res.json({ assignment: { ...assignment, ...extra } });
}

export async function updateAssignment(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params as { id: string };

  const existing = await prisma.assignment.findUnique({
    where: { id },
    select: { id: true, classroomId: true, classroom: { select: { teacherId: true } } },
  });
  if (!existing) throw new HttpError(404, 'Assignment not found');
  if (!isOwnerOrAdmin(user, existing.classroom.teacherId)) throw new HttpError(403, 'Forbidden');

  const data = updateAssignmentSchema.parse(req.body);
  const updated = await prisma.assignment.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
    },
    select: assignmentSelect,
  });
  res.json({ assignment: updated });
}

export async function deleteAssignment(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params as { id: string };

  const existing = await prisma.assignment.findUnique({
    where: { id },
    select: {
      id: true,
      classroom: { select: { teacherId: true } },
      attachments: { select: { storedName: true } },
      submissions: { select: { storedName: true } },
    },
  });
  if (!existing) throw new HttpError(404, 'Assignment not found');
  if (!isOwnerOrAdmin(user, existing.classroom.teacherId)) throw new HttpError(403, 'Forbidden');

  await prisma.assignment.delete({ where: { id } });
  // Best-effort file cleanup after DB cascade
  const { submissionPath } = await import('../utils/uploads.js');
  await Promise.all([
    ...existing.attachments.map((a) => safeUnlink(attachmentPath(a.storedName))),
    ...existing.submissions.map((s) => safeUnlink(submissionPath(s.storedName))),
  ]);
  res.status(204).end();
}

export async function uploadAttachments(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params as { id: string };

  const existing = await prisma.assignment.findUnique({
    where: { id },
    select: { id: true, classroom: { select: { teacherId: true } } },
  });
  if (!existing) throw new HttpError(404, 'Assignment not found');
  if (!isOwnerOrAdmin(user, existing.classroom.teacherId)) {
    // Clean up files Multer already wrote to disk
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    await Promise.all(files.map((f) => safeUnlink(f.path)));
    throw new HttpError(403, 'Forbidden');
  }
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) throw new HttpError(400, 'No files uploaded');

  const created = await prisma.$transaction(
    files.map((f) =>
      prisma.assignmentAttachment.create({
        data: {
          assignmentId: id,
          filename: f.originalname,
          storedName: f.filename,
          mimetype: f.mimetype,
          size: f.size,
        },
        select: { id: true, filename: true, mimetype: true, size: true, createdAt: true },
      }),
    ),
  );
  res.status(201).json({ attachments: created });
}

export async function deleteAttachment(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { attachmentId } = req.params as { attachmentId: string };

  const att = await prisma.assignmentAttachment.findUnique({
    where: { id: attachmentId },
    select: {
      id: true, storedName: true,
      assignment: { select: { classroom: { select: { teacherId: true } } } },
    },
  });
  if (!att) throw new HttpError(404, 'Attachment not found');
  if (!isOwnerOrAdmin(user, att.assignment.classroom.teacherId)) throw new HttpError(403, 'Forbidden');

  await prisma.assignmentAttachment.delete({ where: { id: attachmentId } });
  await safeUnlink(attachmentPath(att.storedName));
  res.status(204).end();
}

export async function downloadAttachment(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { attachmentId } = req.params as { attachmentId: string };

  const att = await prisma.assignmentAttachment.findUnique({
    where: { id: attachmentId },
    select: {
      filename: true, storedName: true, mimetype: true,
      assignment: { select: { classroomId: true } },
    },
  });
  if (!att) throw new HttpError(404, 'Attachment not found');
  await ensureClassroomMember(user, att.assignment.classroomId);

  res.type(att.mimetype);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${sanitizeDownloadName(att.filename)}"`,
  );
  res.sendFile(attachmentPath(att.storedName));
}
