import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../utils/HttpError.js';
import { ensureClassroomOwner } from '../utils/classroomAuth.js';
import { createEventSchema, updateEventSchema } from '../schemas/event.schema.js';
import { notifyAllUsers, notifyClassroom, truncatePreview } from '../utils/notifications.js';

function requireUser(req: Request) {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  return req.user;
}

const eventSelect = {
  id: true,
  type: true,
  title: true,
  description: true,
  location: true,
  meetingUrl: true,
  startsAt: true,
  endsAt: true,
  classroomId: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  classroom: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} as const;

export async function createEvent(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  if (user.role !== 'ADMIN' && user.role !== 'TEACHER') {
    throw new HttpError(403, 'Only faculty or admins can create events');
  }
  const data = createEventSchema.parse(req.body);

  if (data.type === 'CLASS_SESSION' && user.role !== 'ADMIN') {
    throw new HttpError(403, 'Only admins can schedule live classes');
  }

  if (data.classroomId) {
    // Class-scoped event: must be owner of the class (or admin).
    await ensureClassroomOwner(user, data.classroomId);
  } else {
    // Global event: admin only.
    if (user.role !== 'ADMIN') {
      throw new HttpError(403, 'Only admins can create global events');
    }
  }

  const event = await prisma.event.create({
    data: {
      type: data.type,
      title: data.title,
      description: data.description,
      location: data.location,
      meetingUrl: data.meetingUrl,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      classroomId: data.classroomId,
      createdById: user.id,
    },
    select: eventSelect,
  });

  const notifTitle =
    event.type === 'CLASS_SESSION' ? `Live class scheduled: ${event.title}` : `New event: ${event.title}`;
  const descPreview = event.description ? truncatePreview(event.description) : null;
  const notifBody =
    event.type === 'CLASS_SESSION' && event.meetingUrl
      ? `Join: ${event.meetingUrl}${descPreview ? ` · ${descPreview}` : ''}`
      : descPreview;

  if (event.classroomId) {
    await notifyClassroom({
      classroomId: event.classroomId,
      actorId: user.id,
      type: 'EVENT_NEW',
      title: notifTitle,
      body: notifBody,
      eventId: event.id,
    });
  } else {
    await notifyAllUsers({
      actorId: user.id,
      type: 'EVENT_NEW',
      title: notifTitle,
      body: notifBody,
      eventId: event.id,
    });
  }

  res.status(201).json({ event });
}

export async function listMyEvents(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);

  const classroomFilter =
    user.role === 'ADMIN'
      ? undefined
      : user.role === 'TEACHER'
        ? { teacherId: user.id }
        : { enrolments: { some: { studentId: user.id } } };

  const events = await prisma.event.findMany({
    where: {
      OR: [
        { classroomId: null },
        ...(classroomFilter
          ? [{ classroom: classroomFilter }]
          : [{ NOT: { classroomId: null } }]),
      ],
    },
    orderBy: [{ startsAt: 'asc' }],
    select: eventSelect,
  });
  res.json({ events });
}

export async function getEvent(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params as { id: string };
  const event = await prisma.event.findUnique({
    where: { id },
    select: { ...eventSelect, classroom: { select: { id: true, name: true, teacherId: true } } },
  });
  if (!event) throw new HttpError(404, 'Event not found');

  if (event.classroomId && event.classroom) {
    if (user.role !== 'ADMIN' && event.classroom.teacherId !== user.id) {
      const enrolment = await prisma.enrolment.findUnique({
        where: { classroomId_studentId: { classroomId: event.classroomId, studentId: user.id } },
        select: { id: true },
      });
      if (!enrolment) throw new HttpError(403, 'Not a member of this classroom');
    }
  }
  res.json({ event });
}

export async function updateEvent(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params as { id: string };
  const existing = await prisma.event.findUnique({
    where: { id },
    select: { id: true, classroomId: true, createdById: true },
  });
  if (!existing) throw new HttpError(404, 'Event not found');

  if (existing.classroomId) {
    await ensureClassroomOwner(user, existing.classroomId);
  } else if (user.role !== 'ADMIN') {
    throw new HttpError(403, 'Only admins can edit global events');
  }

  const data = updateEventSchema.parse(req.body);

  if (data.type === 'CLASS_SESSION' && user.role !== 'ADMIN') {
    throw new HttpError(403, 'Only admins can schedule live classes');
  }

  const event = await prisma.event.update({
    where: { id },
    data: {
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.location !== undefined ? { location: data.location } : {}),
      ...(data.meetingUrl !== undefined ? { meetingUrl: data.meetingUrl } : {}),
      ...(data.startsAt !== undefined ? { startsAt: data.startsAt } : {}),
      ...(data.endsAt !== undefined ? { endsAt: data.endsAt } : {}),
    },
    select: eventSelect,
  });
  res.json({ event });
}

export async function deleteEvent(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = req.params as { id: string };
  const existing = await prisma.event.findUnique({
    where: { id },
    select: { id: true, classroomId: true },
  });
  if (!existing) throw new HttpError(404, 'Event not found');

  if (existing.classroomId) {
    await ensureClassroomOwner(user, existing.classroomId);
  } else if (user.role !== 'ADMIN') {
    throw new HttpError(403, 'Only admins can delete global events');
  }

  await prisma.event.delete({ where: { id } });
  res.json({ ok: true });
}
