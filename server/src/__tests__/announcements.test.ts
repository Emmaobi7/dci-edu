import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { prisma } from '../db/prisma.js';
import { cleanupByTag, makeEmailFactory, registerAgent, warmDatabase } from './helpers.js';

const app = createApp();
const TAG = `vitest_announcements_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const emailFor = makeEmailFactory(TAG);

// Valid PNG signature followed by junk so the mimetype detector and ext check both pass.
const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('-vitest-fake-payload-'),
]);

async function makeClassWithMembers() {
  const { agent: teacher, user: t } = await registerAgent(app, {
    name: 'AT', email: emailFor(`t_${Math.random().toString(36).slice(2, 6)}`), role: 'TEACHER',
  });
  const { agent: student, user: s } = await registerAgent(app, {
    name: 'AS', email: emailFor(`s_${Math.random().toString(36).slice(2, 6)}`), role: 'STUDENT',
  });
  const created = await teacher.post('/api/classrooms').send({ name: 'Stream Class' });
  const classroomId = created.body.classroom.id as string;
  const code = created.body.classroom.code as string;
  await student.post('/api/enrolments').send({ code });
  return { teacher, student, t, s, classroomId };
}

beforeAll(async () => { await warmDatabase(); });
afterAll(async () => { await cleanupByTag(TAG); await prisma.$disconnect(); });

describe('announcements CRUD', () => {
  it('teacher posts; student cannot post; members can list', async () => {
    const { teacher, student, classroomId } = await makeClassWithMembers();
    const post = await teacher
      .post(`/api/classrooms/${classroomId}/announcements`)
      .send({ body: 'Welcome to the class!' });
    expect(post.status).toBe(201);
    expect(post.body.announcement).toMatchObject({ body: 'Welcome to the class!', isPinned: false });

    const forbidden = await student
      .post(`/api/classrooms/${classroomId}/announcements`)
      .send({ body: 'student should not post' });
    expect(forbidden.status).toBe(403);

    const list = await student.get(`/api/classrooms/${classroomId}/announcements`);
    expect(list.status).toBe(200);
    expect(list.body.announcements).toHaveLength(1);
  });

  it('non-member cannot read; rejects invalid input', async () => {
    const { teacher, classroomId } = await makeClassWithMembers();
    await teacher.post(`/api/classrooms/${classroomId}/announcements`).send({ body: 'hi' });

    const { agent: outsider } = await registerAgent(app, {
      name: 'OUT', email: emailFor(`out_${Math.random().toString(36).slice(2, 6)}`), role: 'STUDENT',
    });
    const denied = await outsider.get(`/api/classrooms/${classroomId}/announcements`);
    expect(denied.status).toBe(403);

    const bad = await teacher.post(`/api/classrooms/${classroomId}/announcements`).send({ body: '' });
    expect(bad.status).toBe(400);
  });

  it('pin/update/delete: only author or admin', async () => {
    const { teacher, classroomId } = await makeClassWithMembers();
    const created = await teacher
      .post(`/api/classrooms/${classroomId}/announcements`)
      .send({ body: 'first' });
    const id = created.body.announcement.id as string;

    const pinned = await teacher.patch(`/api/announcements/${id}`).send({ isPinned: true });
    expect(pinned.status).toBe(200);
    expect(pinned.body.announcement.isPinned).toBe(true);

    const { agent: other } = await registerAgent(app, {
      name: 'TX', email: emailFor(`tx_${Math.random().toString(36).slice(2, 6)}`), role: 'TEACHER',
    });
    const denied = await other.patch(`/api/announcements/${id}`).send({ body: 'hacked' });
    expect(denied.status).toBe(403);

    const del = await teacher.delete(`/api/announcements/${id}`);
    expect(del.status).toBe(204);
  });

  it('pinned announcements come first in list', async () => {
    const { teacher, classroomId } = await makeClassWithMembers();
    const first = await teacher.post(`/api/classrooms/${classroomId}/announcements`).send({ body: 'old' });
    const second = await teacher.post(`/api/classrooms/${classroomId}/announcements`).send({ body: 'new' });
    await teacher.patch(`/api/announcements/${first.body.announcement.id}`).send({ isPinned: true });

    const list = await teacher.get(`/api/classrooms/${classroomId}/announcements`);
    expect(list.body.announcements[0].id).toBe(first.body.announcement.id);
    expect(list.body.announcements[1].id).toBe(second.body.announcement.id);
  });
});

describe('attachments: images + youtube', () => {
  it('teacher uploads image; member downloads; non-member 403', async () => {
    const { teacher, student, classroomId } = await makeClassWithMembers();
    const a = await teacher.post(`/api/classrooms/${classroomId}/announcements`).send({ body: 'with image' });
    const aid = a.body.announcement.id as string;

    const upload = await teacher
      .post(`/api/announcements/${aid}/images`)
      .attach('files', PNG_BYTES, { filename: 'cover.png', contentType: 'image/png' });
    expect(upload.status).toBe(201);
    const attId = upload.body.attachments[0].id as string;
    expect(upload.body.attachments[0].kind).toBe('IMAGE');

    const dl = await student.get(`/api/announcements/attachments/${attId}/file`);
    expect(dl.status).toBe(200);

    const { agent: outsider } = await registerAgent(app, {
      name: 'OUT', email: emailFor(`out2_${Math.random().toString(36).slice(2, 6)}`), role: 'STUDENT',
    });
    const denied = await outsider.get(`/api/announcements/attachments/${attId}/file`);
    expect(denied.status).toBe(403);
  });

  it('rejects non-image mimetypes', async () => {
    const { teacher, classroomId } = await makeClassWithMembers();
    const a = await teacher.post(`/api/classrooms/${classroomId}/announcements`).send({ body: 'x' });
    const bad = await teacher
      .post(`/api/announcements/${a.body.announcement.id}/images`)
      .attach('files', Buffer.from('%PDF-1.4'), { filename: 'no.pdf', contentType: 'application/pdf' });
    expect(bad.status).toBe(400);
  });

  it('accepts valid YouTube URLs and rejects invalid ones', async () => {
    const { teacher, classroomId } = await makeClassWithMembers();
    const a = await teacher
      .post(`/api/classrooms/${classroomId}/announcements`)
      .send({ body: 'with video', youtubeUrls: ['https://youtu.be/dQw4w9WgXcQ'] });
    expect(a.status).toBe(201);
    expect(a.body.announcement.attachments[0]).toMatchObject({ kind: 'YOUTUBE', youtubeId: 'dQw4w9WgXcQ' });

    const aid = a.body.announcement.id as string;
    const more = await teacher.post(`/api/announcements/${aid}/youtube`)
      .send({ url: 'https://www.youtube.com/watch?v=oHg5SJYRHA0' });
    expect(more.status).toBe(201);
    expect(more.body.attachment.youtubeId).toBe('oHg5SJYRHA0');

    const bad = await teacher.post(`/api/announcements/${aid}/youtube`)
      .send({ url: 'https://example.com/not-youtube' });
    expect(bad.status).toBe(400);
  });
});

describe('comments', () => {
  it('member comments; author edits; teacher (classroom owner) can delete others', async () => {
    const { teacher, student, classroomId } = await makeClassWithMembers();
    const a = await teacher.post(`/api/classrooms/${classroomId}/announcements`).send({ body: 'hi' });
    const aid = a.body.announcement.id as string;

    const c = await student.post(`/api/announcements/${aid}/comments`).send({ body: 'thanks!' });
    expect(c.status).toBe(201);
    const cid = c.body.comment.id as string;

    const edit = await student.patch(`/api/announcements/comments/${cid}`).send({ body: 'thanks teacher!' });
    expect(edit.status).toBe(200);
    expect(edit.body.comment.body).toBe('thanks teacher!');

    const del = await teacher.delete(`/api/announcements/comments/${cid}`);
    expect(del.status).toBe(204);
  });

  it('non-member cannot comment', async () => {
    const { teacher, classroomId } = await makeClassWithMembers();
    const a = await teacher.post(`/api/classrooms/${classroomId}/announcements`).send({ body: 'hi' });
    const { agent: outsider } = await registerAgent(app, {
      name: 'OUT', email: emailFor(`out3_${Math.random().toString(36).slice(2, 6)}`), role: 'STUDENT',
    });
    const denied = await outsider
      .post(`/api/announcements/${a.body.announcement.id}/comments`)
      .send({ body: 'spam' });
    expect(denied.status).toBe(403);
  });
});
