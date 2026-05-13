import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { prisma } from '../db/prisma.js';
import { cleanupByTag, makeEmailFactory, registerAgent, warmDatabase } from './helpers.js';

const app = createApp();
const TAG = `vitest_notifications_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const emailFor = makeEmailFactory(TAG);

async function makeClassWithTwoStudents() {
  const { agent: teacher } = await registerAgent(app, {
    name: 'NT', email: emailFor(`t_${Math.random().toString(36).slice(2, 6)}`), role: 'TEACHER',
  });
  const { agent: s1, user: u1 } = await registerAgent(app, {
    name: 'NS1', email: emailFor(`s1_${Math.random().toString(36).slice(2, 6)}`), role: 'STUDENT',
  });
  const { agent: s2, user: u2 } = await registerAgent(app, {
    name: 'NS2', email: emailFor(`s2_${Math.random().toString(36).slice(2, 6)}`), role: 'STUDENT',
  });
  const created = await teacher.post('/api/classrooms').send({ name: 'Notify Class' });
  const classroomId = created.body.classroom.id as string;
  const code = created.body.classroom.code as string;
  await s1.post('/api/enrolments').send({ code });
  await s2.post('/api/enrolments').send({ code });
  return { teacher, s1, s2, u1, u2, classroomId };
}

beforeAll(async () => { await warmDatabase(); });
afterAll(async () => { await cleanupByTag(TAG); await prisma.$disconnect(); });

describe('notifications', () => {
  it('announcement create fans out to every enrolled student, not the teacher', async () => {
    const { teacher, s1, s2, classroomId } = await makeClassWithTwoStudents();
    await teacher.post(`/api/classrooms/${classroomId}/announcements`).send({ body: 'hello' });

    const t = await teacher.get('/api/notifications/unread-count');
    expect(t.body.count).toBe(0);

    for (const s of [s1, s2]) {
      const c = await s.get('/api/notifications/unread-count');
      expect(c.body.count).toBe(1);
      const list = await s.get('/api/notifications');
      expect(list.body.notifications).toHaveLength(1);
      expect(list.body.notifications[0].type).toBe('ANNOUNCEMENT_NEW');
      expect(list.body.notifications[0].readAt).toBeNull();
    }
  });

  it('assignment create also fans out', async () => {
    const { teacher, s1, classroomId } = await makeClassWithTwoStudents();
    await teacher.post(`/api/classrooms/${classroomId}/assignments`).send({ title: 'A1' });
    const list = await s1.get('/api/notifications');
    expect(list.body.notifications.some((n: { type: string }) => n.type === 'ASSIGNMENT_NEW')).toBe(true);
  });

  it('mark one read and mark all read', async () => {
    const { teacher, s1, classroomId } = await makeClassWithTwoStudents();
    await teacher.post(`/api/classrooms/${classroomId}/announcements`).send({ body: 'one' });
    await teacher.post(`/api/classrooms/${classroomId}/announcements`).send({ body: 'two' });

    const before = await s1.get('/api/notifications/unread-count');
    expect(before.body.count).toBe(2);

    const list = await s1.get('/api/notifications');
    const firstId = list.body.notifications[0].id as string;
    const r1 = await s1.post(`/api/notifications/${firstId}/read`);
    expect(r1.status).toBe(200);

    const mid = await s1.get('/api/notifications/unread-count');
    expect(mid.body.count).toBe(1);

    const r2 = await s1.post('/api/notifications/read-all');
    expect(r2.status).toBe(200);
    const after = await s1.get('/api/notifications/unread-count');
    expect(after.body.count).toBe(0);
  });

  it('cannot mark another user\'s notification as read', async () => {
    const { teacher, s1, s2, classroomId } = await makeClassWithTwoStudents();
    await teacher.post(`/api/classrooms/${classroomId}/announcements`).send({ body: 'shared' });
    const s1List = await s1.get('/api/notifications');
    const s1NotifId = s1List.body.notifications[0].id as string;
    const denied = await s2.post(`/api/notifications/${s1NotifId}/read`);
    expect(denied.status).toBe(404);
  });

  it('?unread=1 filter returns only unread', async () => {
    const { teacher, s1, classroomId } = await makeClassWithTwoStudents();
    await teacher.post(`/api/classrooms/${classroomId}/announcements`).send({ body: 'a' });
    await teacher.post(`/api/classrooms/${classroomId}/announcements`).send({ body: 'b' });
    const list = await s1.get('/api/notifications');
    await s1.post(`/api/notifications/${list.body.notifications[0].id}/read`);

    const unread = await s1.get('/api/notifications?unread=1');
    expect(unread.body.notifications).toHaveLength(1);
    expect(unread.body.notifications[0].readAt).toBeNull();
  });
});
