import { NotificationType } from '@prisma/client';
import { prisma } from '../db/prisma.js';

/**
 * Fan out a notification to every student enrolled in a classroom, excluding the actor.
 * Notifications are best-effort: failure does not abort the parent transaction.
 */
export async function notifyClassroom(opts: {
  classroomId: string;
  actorId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  announcementId?: string;
  assignmentId?: string;
  quizId?: string;
}): Promise<void> {
  try {
    const enrolments = await prisma.enrolment.findMany({
      where: { classroomId: opts.classroomId, studentId: { not: opts.actorId } },
      select: { studentId: true },
    });
    if (enrolments.length === 0) return;
    await prisma.notification.createMany({
      data: enrolments.map((e) => ({
        userId: e.studentId,
        type: opts.type,
        classroomId: opts.classroomId,
        announcementId: opts.announcementId,
        assignmentId: opts.assignmentId,
        quizId: opts.quizId,
        title: opts.title,
        body: opts.body ?? null,
      })),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('notifyClassroom failed:', err);
  }
}

/**
 * Fan out a COMMENT_NEW notification to thread participants:
 * announcement author + any prior commenter, excluding the actor.
 */
export async function notifyCommentParticipants(opts: {
  announcementId: string;
  classroomId: string;
  actorId: string;
  title: string;
  body?: string | null;
}): Promise<void> {
  try {
    const announcement = await prisma.announcement.findUnique({
      where: { id: opts.announcementId },
      select: {
        authorId: true,
        comments: { select: { authorId: true } },
      },
    });
    if (!announcement) return;
    const recipientIds = new Set<string>([announcement.authorId]);
    for (const c of announcement.comments) recipientIds.add(c.authorId);
    recipientIds.delete(opts.actorId);
    if (recipientIds.size === 0) return;
    await prisma.notification.createMany({
      data: Array.from(recipientIds).map((userId) => ({
        userId,
        type: NotificationType.COMMENT_NEW,
        classroomId: opts.classroomId,
        announcementId: opts.announcementId,
        title: opts.title,
        body: opts.body ?? null,
      })),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('notifyCommentParticipants failed:', err);
  }
}

export function truncatePreview(s: string, max = 140): string {
  const trimmed = s.replace(/\s+/g, ' ').trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}\u2026` : trimmed;
}
