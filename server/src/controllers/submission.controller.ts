import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../utils/HttpError.js';
import { isOwnerOrAdmin } from '../utils/classroomAuth.js';
import { gradeSubmissionSchema } from '../schemas/assignment.schema.js';
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

const submissionPublic = {
  id: true,
  assignmentId: true,
  studentId: true,
  filename: true,
  mimetype: true,
  size: true,
  isLate: true,
  grade: true,
  feedback: true,
  gradedAt: true,
  submittedAt: true,
  updatedAt: true,
  student: { select: { id: true, name: true, email: true } },
  gradedBy: { select: { id: true, name: true } },
  attachments: {
    select: { id: true, filename: true, mimetype: true, size: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  },
} as const;

async function loadAssignmentContext(assignmentId: string) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true, dueDate: true, classroomId: true,
      classroom: { select: { teacherId: true } },
    },
  });
  if (!assignment) throw new HttpError(404, 'Assignment not found');
  return assignment;
}

export async function submitAssignment(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id: assignmentId } = req.params as { id: string };
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];

  if (user.role !== 'STUDENT') throw new HttpError(403, 'Only students can submit');
  if (files.length === 0) throw new HttpError(400, 'At least one file is required');

  const assignment = await loadAssignmentContext(assignmentId);

  const enrolment = await prisma.enrolment.findUnique({
    where: { classroomId_studentId: { classroomId: assignment.classroomId, studentId: user.id } },
    select: { id: true },
  });
  if (!enrolment) throw new HttpError(403, 'Not enrolled in this classroom');

  const existing = await prisma.submission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId: user.id } },
    select: {
      id: true,
      storedName: true,
      gradedAt: true,
      attachments: { select: { id: true, storedName: true } },
    },
  });
  if (existing?.gradedAt) {
    throw new HttpError(409, 'This submission has already been graded and cannot be replaced');
  }

  const stored = await Promise.all(
    files.map(async (f) => ({ file: f, storedName: await persistUpload('submissions', f) })),
  );
  const now = new Date();
  const isLate = assignment.dueDate ? now > assignment.dueDate : false;

  let submission;
  if (existing) {
    submission = await prisma.$transaction(async (tx) => {
      await tx.submissionAttachment.deleteMany({ where: { submissionId: existing.id } });
      const updated = await tx.submission.update({
        where: { id: existing.id },
        data: {
          // Clear legacy single-file columns; new attachments live in the relation.
          filename: null,
          storedName: null,
          mimetype: null,
          size: null,
          isLate,
          submittedAt: now,
          attachments: {
            create: stored.map(({ file: f, storedName }) => ({
              filename: f.originalname,
              storedName,
              mimetype: f.mimetype,
              size: f.size,
            })),
          },
        },
        select: submissionPublic,
      });
      return updated;
    });
    // Best-effort cleanup of previously stored blobs (legacy single file + old attachments).
    if (existing.storedName) {
      await removeStoredObject('submissions', existing.storedName).catch(() => {});
    }
    await Promise.all(
      existing.attachments.map((a) => removeStoredObject('submissions', a.storedName).catch(() => {})),
    );
  } else {
    submission = await prisma.submission.create({
      data: {
        assignmentId,
        studentId: user.id,
        isLate,
        attachments: {
          create: stored.map(({ file: f, storedName }) => ({
            filename: f.originalname,
            storedName,
            mimetype: f.mimetype,
            size: f.size,
          })),
        },
      },
      select: submissionPublic,
    });
  }
  res.status(201).json({ submission });
}

export async function getMySubmission(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id: assignmentId } = req.params as { id: string };
  const submission = await prisma.submission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId: user.id } },
    select: submissionPublic,
  });
  res.json({ submission });
}

export async function listSubmissions(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id: assignmentId } = req.params as { id: string };
  const assignment = await loadAssignmentContext(assignmentId);
  if (!isOwnerOrAdmin(user, assignment.classroom.teacherId)) throw new HttpError(403, 'Forbidden');

  const submissions = await prisma.submission.findMany({
    where: { assignmentId },
    orderBy: { submittedAt: 'desc' },
    select: submissionPublic,
  });
  res.json({ submissions });
}

export async function gradeSubmission(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { submissionId } = req.params as { submissionId: string };

  const existing = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, assignment: { select: { classroom: { select: { teacherId: true } } } } },
  });
  if (!existing) throw new HttpError(404, 'Submission not found');
  if (!isOwnerOrAdmin(user, existing.assignment.classroom.teacherId)) throw new HttpError(403, 'Forbidden');

  const data = gradeSubmissionSchema.parse(req.body);
  const submission = await prisma.submission.update({
    where: { id: submissionId },
    data: {
      grade: data.grade,
      feedback: data.feedback,
      gradedAt: new Date(),
      gradedById: user.id,
    },
    select: submissionPublic,
  });
  res.json({ submission });
}

export async function downloadSubmission(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { submissionId } = req.params as { submissionId: string };

  const sub = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      filename: true, storedName: true, mimetype: true, studentId: true,
      assignment: { select: { classroom: { select: { teacherId: true } } } },
    },
  });
  if (!sub) throw new HttpError(404, 'Submission not found');
  if (!sub.storedName || !sub.filename) {
    throw new HttpError(404, 'This submission has no single file; download individual attachments instead');
  }

  const isTeacher = isOwnerOrAdmin(user, sub.assignment.classroom.teacherId);
  const isOwnerStudent = user.id === sub.studentId;
  if (!isTeacher && !isOwnerStudent) throw new HttpError(403, 'Forbidden');

  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${sanitizeDownloadName(sub.filename)}"`,
  );
  await streamStoredObject(res, 'submissions', sub.storedName, sub.mimetype ?? 'application/octet-stream');
}

export async function downloadSubmissionAttachment(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { attachmentId } = req.params as { attachmentId: string };

  const att = await prisma.submissionAttachment.findUnique({
    where: { id: attachmentId },
    select: {
      filename: true, storedName: true, mimetype: true,
      submission: {
        select: {
          studentId: true,
          assignment: { select: { classroom: { select: { teacherId: true } } } },
        },
      },
    },
  });
  if (!att) throw new HttpError(404, 'Attachment not found');

  const isTeacher = isOwnerOrAdmin(user, att.submission.assignment.classroom.teacherId);
  const isOwnerStudent = user.id === att.submission.studentId;
  if (!isTeacher && !isOwnerStudent) throw new HttpError(403, 'Forbidden');

  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${sanitizeDownloadName(att.filename)}"`,
  );
  await streamStoredObject(res, 'submissions', att.storedName, att.mimetype);
}
