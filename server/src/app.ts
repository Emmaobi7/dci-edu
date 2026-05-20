import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import classroomRoutes from './routes/classroom.routes.js';
import enrolmentRoutes from './routes/enrolment.routes.js';
import assignmentRoutes from './routes/assignment.routes.js';
import announcementRoutes from './routes/announcement.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import quizRoutes from './routes/quiz.routes.js';
import eventRoutes from './routes/event.routes.js';
import meRoutes from './routes/me.routes.js';
import messageRoutes from './routes/message.routes.js';
import usersRoutes from './routes/users.routes.js';
import adminRoutes from './routes/admin.routes.js';
import resourceRoutes from './routes/resource.routes.js';
import { errorHandler, notFound } from './middleware/error.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/classrooms', classroomRoutes);
  app.use('/api/enrolments', enrolmentRoutes);
  app.use('/api/assignments', assignmentRoutes);
  app.use('/api/announcements', announcementRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/quizzes', quizRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/me', meRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/resources', resourceRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
