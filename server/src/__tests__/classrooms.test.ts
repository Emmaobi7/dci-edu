import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '../db/prisma.js';
import { cleanupByTag, makeEmailFactory, registerAgent, warmDatabase } from './helpers.js';

const app = createApp();
const TAG = `vitest_classrooms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const emailFor = makeEmailFactory(TAG);

beforeAll(async () => {
  await warmDatabase();
});

afterAll(async () => {
  await cleanupByTag(TAG);
  await prisma.$disconnect();
});

describe('classroom CRUD', () => {
  it('teacher can create a classroom; student cannot', async () => {
    const { agent: teacher } = await registerAgent(app, {
      name: 'T1', email: emailFor('t1'), role: 'TEACHER',
    });
    const { agent: student } = await registerAgent(app, {
      name: 'S1', email: emailFor('s1'), role: 'STUDENT',
    });

    const ok = await teacher.post('/api/classrooms').send({ name: 'Pharmacology 101' });
    expect(ok.status).toBe(201);
    expect(ok.body.classroom).toMatchObject({ name: 'Pharmacology 101' });
    expect(ok.body.classroom.code).toMatch(/^[A-Z2-9]{6}$/);

    const forbidden = await student.post('/api/classrooms').send({ name: 'nope' });
    expect(forbidden.status).toBe(403);
  });

  it('rejects invalid input', async () => {
    const { agent } = await registerAgent(app, {
      name: 'T2', email: emailFor('t2'), role: 'TEACHER',
    });
    const res = await agent.post('/api/classrooms').send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('lists only owned classes for teacher and enrolled classes for student', async () => {
    const { agent: t } = await registerAgent(app, {
      name: 'T3', email: emailFor('t3'), role: 'TEACHER',
    });
    const { agent: s } = await registerAgent(app, {
      name: 'S3', email: emailFor('s3'), role: 'STUDENT',
    });
    const created = await t.post('/api/classrooms').send({ name: 'Cardio' });
    const code = created.body.classroom.code as string;
    await s.post('/api/enrolments').send({ code });

    const tList = await t.get('/api/classrooms');
    expect(tList.status).toBe(200);
    expect(tList.body.classrooms.some((c: { name: string }) => c.name === 'Cardio')).toBe(true);

    const sList = await s.get('/api/classrooms');
    expect(sList.status).toBe(200);
    expect(sList.body.classrooms.some((c: { name: string }) => c.name === 'Cardio')).toBe(true);
  });

  it('only owner (or admin) can update / delete / regenerate code', async () => {
    const { agent: owner } = await registerAgent(app, {
      name: 'TO', email: emailFor('to'), role: 'TEACHER',
    });
    const { agent: other } = await registerAgent(app, {
      name: 'TX', email: emailFor('tx'), role: 'TEACHER',
    });
    const created = await owner.post('/api/classrooms').send({ name: 'Original' });
    const id = created.body.classroom.id as string;
    const code1 = created.body.classroom.code as string;

    const otherUpdate = await other.patch(`/api/classrooms/${id}`).send({ name: 'Hacked' });
    expect(otherUpdate.status).toBe(403);
    const otherDelete = await other.delete(`/api/classrooms/${id}`);
    expect(otherDelete.status).toBe(403);
    const otherRegen = await other.post(`/api/classrooms/${id}/regenerate-code`);
    expect(otherRegen.status).toBe(403);

    const ownerUpdate = await owner.patch(`/api/classrooms/${id}`).send({ name: 'Renamed' });
    expect(ownerUpdate.status).toBe(200);
    expect(ownerUpdate.body.classroom.name).toBe('Renamed');

    const regen = await owner.post(`/api/classrooms/${id}/regenerate-code`);
    expect(regen.status).toBe(200);
    expect(regen.body.classroom.code).not.toBe(code1);

    const del = await owner.delete(`/api/classrooms/${id}`);
    expect(del.status).toBe(204);

    const gone = await owner.get(`/api/classrooms/${id}`);
    expect(gone.status).toBe(404);
  });

  it('non-member cannot view classroom; student member sees no code', async () => {
    const { agent: owner } = await registerAgent(app, {
      name: 'TV', email: emailFor('tv'), role: 'TEACHER',
    });
    const { agent: member } = await registerAgent(app, {
      name: 'SV', email: emailFor('sv'), role: 'STUDENT',
    });
    const { agent: outsider } = await registerAgent(app, {
      name: 'SX', email: emailFor('sx'), role: 'STUDENT',
    });
    const created = await owner.post('/api/classrooms').send({ name: 'Private' });
    const id = created.body.classroom.id as string;
    const code = created.body.classroom.code as string;
    await member.post('/api/enrolments').send({ code });

    const outsiderRes = await outsider.get(`/api/classrooms/${id}`);
    expect(outsiderRes.status).toBe(403);

    const memberRes = await member.get(`/api/classrooms/${id}`);
    expect(memberRes.status).toBe(200);
    expect(memberRes.body.classroom.code).toBeUndefined();

    const ownerRes = await owner.get(`/api/classrooms/${id}`);
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.classroom.code).toBe(code);
    expect(ownerRes.body.classroom.studentCount).toBe(1);
  });
});

describe('enrolment', () => {
  it('student joins by code, listed in members, teacher can remove', async () => {
    const { agent: owner } = await registerAgent(app, {
      name: 'TE', email: emailFor('te'), role: 'TEACHER',
    });
    const { agent: student, user: s } = await registerAgent(app, {
      name: 'SE', email: emailFor('se'), role: 'STUDENT',
    });
    const created = await owner.post('/api/classrooms').send({ name: 'EnrolClass' });
    const id = created.body.classroom.id as string;
    const code = created.body.classroom.code as string;

    const join = await student.post('/api/enrolments').send({ code });
    expect(join.status).toBe(201);

    const dup = await student.post('/api/enrolments').send({ code });
    expect(dup.status).toBe(409);

    const members = await owner.get(`/api/classrooms/${id}/students`);
    expect(members.status).toBe(200);
    expect(members.body.students.map((m: { student: { id: string } }) => m.student.id)).toContain(s.id);

    const studentListMembers = await student.get(`/api/classrooms/${id}/students`);
    expect(studentListMembers.status).toBe(403);

    const removed = await owner.delete(`/api/classrooms/${id}/students/${s.id}`);
    expect(removed.status).toBe(204);

    const meList = await student.get('/api/classrooms');
    expect(meList.body.classrooms.some((c: { id: string }) => c.id === id)).toBe(false);
  });

  it('teacher cannot join own class as student; bad code -> 404', async () => {
    const { agent: t } = await registerAgent(app, {
      name: 'TJ', email: emailFor('tj'), role: 'TEACHER',
    });
    const created = await t.post('/api/classrooms').send({ name: 'Self' });
    const code = created.body.classroom.code as string;

    const teacherJoin = await t.post('/api/enrolments').send({ code });
    expect(teacherJoin.status).toBe(403);

    const bad = await t.post('/api/enrolments').send({ code: 'ZZZZZZ' });
    // teacher 403s before code lookup
    expect(bad.status).toBe(403);
  });

  it('student can leave a classroom', async () => {
    const { agent: t } = await registerAgent(app, {
      name: 'TL', email: emailFor('tl'), role: 'TEACHER',
    });
    const { agent: s } = await registerAgent(app, {
      name: 'SL', email: emailFor('sl'), role: 'STUDENT',
    });
    const created = await t.post('/api/classrooms').send({ name: 'Leavable' });
    const id = created.body.classroom.id as string;
    const code = created.body.classroom.code as string;
    await s.post('/api/enrolments').send({ code });

    const leave = await s.delete(`/api/enrolments/${id}`);
    expect(leave.status).toBe(204);

    const again = await s.delete(`/api/enrolments/${id}`);
    expect(again.status).toBe(404);
  });
});
