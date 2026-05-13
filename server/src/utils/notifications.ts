import type { NotificationType } from '@prisma/client';
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
        title: opts.title,
        body: opts.body ?? null,
      })),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('notifyClassroom failed:', err);
  }
}

export function truncatePreview(s: string, max = 140): string {
  const trimmed = s.replace(/\s+/g, ' ').trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}\u2026` : trimmed;
}
