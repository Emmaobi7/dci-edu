import type { Server as HttpServer } from 'http';
import { Server as IOServer, type Socket } from 'socket.io';
import cookie from 'cookie';
import type { Role } from '@prisma/client';
import { env } from '../config/env.js';
import { AUTH_COOKIE } from '../utils/cookies.js';
import { verifyToken } from '../utils/jwt.js';
import { prisma } from '../db/prisma.js';
import { loadChatRole } from '../utils/classroomAuth.js';
import { messageBodySchema } from '../schemas/message.schema.js';

interface SocketUser { id: string; role: Role; name: string }

let ioInstance: IOServer | null = null;

export function roomName(classroomId: string): string {
  return `classroom:${classroomId}`;
}

export function getIo(): IOServer | null {
  return ioInstance;
}

export function initSocket(server: HttpServer): IOServer {
  const io = new IOServer(server, {
    cors: { origin: env.CLIENT_ORIGIN, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const raw = socket.handshake.headers.cookie ?? '';
      const parsed = cookie.parse(raw);
      const token = parsed[AUTH_COOKIE];
      if (!token) return next(new Error('Not authenticated'));
      const payload = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true, name: true },
      });
      if (!user) return next(new Error('User not found'));
      (socket.data as { user: SocketUser }).user = user;
      next();
    } catch {
      next(new Error('Invalid session'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket.data as { user: SocketUser }).user;

    socket.on('chat:join', async (payload: { classroomId?: string }, ack?: (r: unknown) => void) => {
      const classroomId = String(payload?.classroomId ?? '');
      if (!classroomId) return ack?.({ ok: false, error: 'classroomId required' });
      try {
        const role = await loadChatRole({ id: user.id, role: user.role }, classroomId);
        const room = roomName(classroomId);
        await socket.join(room);
        const sockets = await io.in(room).fetchSockets();
        const onlineUserIds = Array.from(
          new Set(sockets.map((s) => (s.data as { user: SocketUser }).user.id)),
        );
        socket.emit('presence:state', { classroomId, userIds: onlineUserIds });
        socket.to(room).emit('presence:join', { classroomId, userId: user.id });
        ack?.({ ok: true, role });
      } catch (err) {
        ack?.({ ok: false, error: (err as Error).message });
      }
    });

    socket.on('chat:leave', async (payload: { classroomId?: string }) => {
      const classroomId = String(payload?.classroomId ?? '');
      if (!classroomId) return;
      const room = roomName(classroomId);
      await socket.leave(room);
      const stillHere = await userStillInRoom(io, room, user.id);
      if (!stillHere) {
        io.to(room).emit('presence:leave', { classroomId, userId: user.id });
      }
    });

    socket.on('message:send', async (
      payload: { classroomId?: string; body?: string },
      ack?: (r: unknown) => void,
    ) => {
      try {
        const classroomId = String(payload?.classroomId ?? '');
        const parsed = messageBodySchema.safeParse({ body: payload?.body });
        if (!classroomId) return ack?.({ ok: false, error: 'classroomId required' });
        if (!parsed.success) return ack?.({ ok: false, error: 'Invalid message' });
        const role = await loadChatRole({ id: user.id, role: user.role }, classroomId);
        if (role.isMuted) return ack?.({ ok: false, error: 'You have been muted' });
        const message = await prisma.message.create({
          data: { classroomId, senderId: user.id, body: parsed.data.body },
          select: messageSelect,
        });
        io.to(roomName(classroomId)).emit('message:new', { message });
        ack?.({ ok: true, message });
      } catch (err) {
        ack?.({ ok: false, error: (err as Error).message });
      }
    });

    socket.on('disconnecting', async () => {
      const rooms = [...socket.rooms].filter((r) => r.startsWith('classroom:'));
      for (const room of rooms) {
        const classroomId = room.slice('classroom:'.length);
        const stillHere = await userStillInRoom(io, room, user.id, socket.id);
        if (!stillHere) {
          socket.to(room).emit('presence:leave', { classroomId, userId: user.id });
        }
      }
    });
  });

  ioInstance = io;
  return io;
}

async function userStillInRoom(
  io: IOServer, room: string, userId: string, excludeSocketId?: string,
): Promise<boolean> {
  const sockets = await io.in(room).fetchSockets();
  return sockets.some((s) => {
    if (excludeSocketId && s.id === excludeSocketId) return false;
    return (s.data as { user: SocketUser }).user.id === userId;
  });
}

export const messageSelect = {
  id: true,
  classroomId: true,
  senderId: true,
  body: true,
  createdAt: true,
  deletedAt: true,
  deletedById: true,
  sender: { select: { id: true, name: true } },
} as const;
