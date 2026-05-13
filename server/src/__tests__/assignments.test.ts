import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { prisma } from '../db/prisma.js';
import { cleanupByTag, makeEmailFactory, registerAgent, warmDatabase } from './helpers.js';

const app = createApp();
const TAG = `vitest_assignments_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const emailFor = makeEmailFactory(TAG);

// Minimal but valid PDF skeleton recognised by Multer (mimetype matched by client header)
const PDF_BYTES = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF\n');
const DOCX_BYTES = Buffer.from('PK\u0003\u0004fakedocx');

async function makeClassroomWithStudent() {
  const { agent: teacher, user: t } = await registerAgent(app, {
    name: 'AT', email: emailFor(`t_${Math.random().toString(36).slice(2, 6)}`), role: 'TEACHER',
  });
  const { agent: student, user: s } = await registerAgent(app, {
    name: 'AS', email: emailFor(`s_${Math.random().toString(36).slice(2, 6)}`), role: 'STUDENT',
  });
  const created = await teacher.post('/api/classrooms').send({ name: 'Assignments Class' });
  const classroomId = created.body.classroom.id as string;
  const code = created.body.classroom.code as string;
  await student.post('/api/enrolments').send({ code });
  return { teacher, student, t, s, classroomId };
}

beforeAll(async () => {
  await warmDatabase();
});

afterAll(async () => {
  await cleanupByTag(TAG);
  await prisma.$disconnect();
});

describe('assignments CRUD', () => {
  it('teacher creates an assignment; student cannot', async () => {
    const { teacher, student, classroomId } = await makeClassroomWithStudent();
    const ok = await teacher
      .post(`/api/classrooms/${classroomId}/assignments`)
      .send({ title: 'Essay 1', description: 'Write 500 words' });
    expect(ok.status).toBe(201);
    expect(ok.body.assignment).toMatchObject({ title: 'Essay 1', classroomId });

    const forbidden = await student
      .post(`/api/classrooms/${classroomId}/assignments`)
      .send({ title: 'nope' });
    expect(forbidden.status).toBe(403);
  });

  it('rejects invalid input', async () => {
    const { teacher, classroomId } = await makeClassroomWithStudent();
    const res = await teacher.post(`/api/classrooms/${classroomId}/assignments`).send({ title: '' });
    expect(res.status).toBe(400);
  });

  it('members can list and view; non-member gets 403', async () => {
    const { teacher, student, classroomId } = await makeClassroomWithStudent();
    const created = await teacher
      .post(`/api/classrooms/${classroomId}/assignments`)
      .send({ title: 'Viewable' });
    const id = created.body.assignment.id as string;

    const tList = await teacher.get(`/api/classrooms/${classroomId}/assignments`);
    expect(tList.status).toBe(200);
    expect(tList.body.assignments.some((a: { id: string }) => a.id === id)).toBe(true);

    const sView = await student.get(`/api/assignments/${id}`);
    expect(sView.status).toBe(200);
    expect(sView.body.assignment.title).toBe('Viewable');

    const { agent: outsider } = await registerAgent(app, {
      name: 'OUT', email: emailFor(`out_${Math.random().toString(36).slice(2, 6)}`), role: 'STUDENT',
    });
    const out = await outsider.get(`/api/assignments/${id}`);
    expect(out.status).toBe(403);
  });

  it('only owner can update / delete', async () => {
    const { teacher, classroomId } = await makeClassroomWithStudent();
    const { agent: otherTeacher } = await registerAgent(app, {
      name: 'OT', email: emailFor(`ot_${Math.random().toString(36).slice(2, 6)}`), role: 'TEACHER',
    });
    const created = await teacher.post(`/api/classrooms/${classroomId}/assignments`).send({ title: 'Mine' });
    const id = created.body.assignment.id as string;

    const denyEdit = await otherTeacher.patch(`/api/assignments/${id}`).send({ title: 'Hijack' });
    expect(denyEdit.status).toBe(403);
    const denyDel = await otherTeacher.delete(`/api/assignments/${id}`);
    expect(denyDel.status).toBe(403);

    const ok = await teacher.patch(`/api/assignments/${id}`).send({ title: 'Renamed' });
    expect(ok.status).toBe(200);
    expect(ok.body.assignment.title).toBe('Renamed');

    const del = await teacher.delete(`/api/assignments/${id}`);
    expect(del.status).toBe(204);
  });
});

describe('assignment attachments (teacher instruction files)', () => {
  it('teacher uploads, member downloads, non-member 403', async () => {
    const { teacher, student, classroomId } = await makeClassroomWithStudent();
    const created = await teacher
      .post(`/api/classrooms/${classroomId}/assignments`)
      .send({ title: 'With files' });
    const id = created.body.assignment.id as string;

    const up = await teacher
      .post(`/api/assignments/${id}/attachments`)
      .attach('files', PDF_BYTES, { filename: 'rubric.pdf', contentType: 'application/pdf' });
    expect(up.status).toBe(201);
    expect(up.body.attachments).toHaveLength(1);
    const attachmentId = up.body.attachments[0].id as string;

    const memberDl = await student.get(`/api/assignments/attachments/${attachmentId}/file`);
    expect(memberDl.status).toBe(200);
    expect(memberDl.headers['content-disposition']).toContain('rubric.pdf');

    const { agent: outsider } = await registerAgent(app, {
      name: 'O2', email: emailFor(`o2_${Math.random().toString(36).slice(2, 6)}`), role: 'STUDENT',
    });
    const dlOut = await outsider.get(`/api/assignments/attachments/${attachmentId}/file`);
    expect(dlOut.status).toBe(403);
  });

  it('rejects disallowed mimetypes', async () => {
    const { teacher, classroomId } = await makeClassroomWithStudent();
    const created = await teacher.post(`/api/classrooms/${classroomId}/assignments`).send({ title: 'A' });
    const id = created.body.assignment.id as string;
    const bad = await teacher
      .post(`/api/assignments/${id}/attachments`)
      .attach('files', Buffer.from('hello'), { filename: 'evil.exe', contentType: 'application/octet-stream' });
    expect(bad.status).toBe(400);
  });
});

describe('submissions', () => {
  it('student submits, replaces before grading, teacher grades, resubmit blocked after grading', async () => {
    const { teacher, student, classroomId, s } = await makeClassroomWithStudent();
    const created = await teacher
      .post(`/api/classrooms/${classroomId}/assignments`)
      .send({ title: 'Submit me' });
    const aId = created.body.assignment.id as string;

    const sub1 = await student
      .post(`/api/assignments/${aId}/submissions`)
      .attach('file', PDF_BYTES, { filename: 'first.pdf', contentType: 'application/pdf' });
    expect(sub1.status).toBe(201);
    expect(sub1.body.submission).toMatchObject({ filename: 'first.pdf', studentId: s.id, isLate: false });

    const sub2 = await student
      .post(`/api/assignments/${aId}/submissions`)
      .attach('file', DOCX_BYTES, {
        filename: 'second.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
    expect(sub2.status).toBe(201);
    expect(sub2.body.submission.filename).toBe('second.docx');
    expect(sub2.body.submission.id).toBe(sub1.body.submission.id);

    const list = await teacher.get(`/api/assignments/${aId}/submissions`);
    expect(list.status).toBe(200);
    expect(list.body.submissions).toHaveLength(1);
    const subId = list.body.submissions[0].id as string;

    const grade = await teacher
      .patch(`/api/assignments/submissions/${subId}/grade`)
      .send({ grade: 87, feedback: 'Solid work' });
    expect(grade.status).toBe(200);
    expect(grade.body.submission).toMatchObject({ grade: 87, feedback: 'Solid work' });
    expect(grade.body.submission.gradedAt).toBeTruthy();

    const blocked = await student
      .post(`/api/assignments/${aId}/submissions`)
      .attach('file', PDF_BYTES, { filename: 'late.pdf', contentType: 'application/pdf' });
    expect(blocked.status).toBe(409);

    const mine = await student.get(`/api/assignments/${aId}/submissions/me`);
    expect(mine.status).toBe(200);
    expect(mine.body.submission.grade).toBe(87);
  });

  it('flags late submissions when past due date', async () => {
    const { teacher, student, classroomId } = await makeClassroomWithStudent();
    const past = new Date(Date.now() - 60_000).toISOString();
    const created = await teacher
      .post(`/api/classrooms/${classroomId}/assignments`)
      .send({ title: 'Due in past', dueDate: past });
    const aId = created.body.assignment.id as string;

    const sub = await student
      .post(`/api/assignments/${aId}/submissions`)
      .attach('file', PDF_BYTES, { filename: 'late.pdf', contentType: 'application/pdf' });
    expect(sub.status).toBe(201);
    expect(sub.body.submission.isLate).toBe(true);
  });

  it('teacher cannot submit; outsider student cannot submit', async () => {
    const { teacher, classroomId } = await makeClassroomWithStudent();
    const created = await teacher
      .post(`/api/classrooms/${classroomId}/assignments`)
      .send({ title: 'No teacher submit' });
    const aId = created.body.assignment.id as string;

    const tSubmit = await teacher
      .post(`/api/assignments/${aId}/submissions`)
      .attach('file', PDF_BYTES, { filename: 'x.pdf', contentType: 'application/pdf' });
    expect(tSubmit.status).toBe(403);

    const { agent: outsider } = await registerAgent(app, {
      name: 'O3', email: emailFor(`o3_${Math.random().toString(36).slice(2, 6)}`), role: 'STUDENT',
    });
    const oSubmit = await outsider
      .post(`/api/assignments/${aId}/submissions`)
      .attach('file', PDF_BYTES, { filename: 'x.pdf', contentType: 'application/pdf' });
    expect(oSubmit.status).toBe(403);
  });

  it('submission download: owner-student and teacher OK, other student 403', async () => {
    const { teacher, student, classroomId } = await makeClassroomWithStudent();
    const created = await teacher
      .post(`/api/classrooms/${classroomId}/assignments`)
      .send({ title: 'Download test' });
    const aId = created.body.assignment.id as string;
    const sub = await student
      .post(`/api/assignments/${aId}/submissions`)
      .attach('file', PDF_BYTES, { filename: 'd.pdf', contentType: 'application/pdf' });
    const subId = sub.body.submission.id as string;

    const ownerDl = await student.get(`/api/assignments/submissions/${subId}/file`);
    expect(ownerDl.status).toBe(200);
    const teacherDl = await teacher.get(`/api/assignments/submissions/${subId}/file`);
    expect(teacherDl.status).toBe(200);

    // Another student in the SAME classroom must not be able to download a peer's submission
    const { agent: peer } = await registerAgent(app, {
      name: 'PEER', email: emailFor(`peer_${Math.random().toString(36).slice(2, 6)}`), role: 'STUDENT',
    });
    // Get the class code via owner's list to enrol the peer
    const code = (await teacher.get('/api/classrooms')).body.classrooms.find(
      (c: { id: string; code: string }) => c.id === classroomId,
    ).code as string;
    await peer.post('/api/enrolments').send({ code });
    const peerDl = await peer.get(`/api/assignments/submissions/${subId}/file`);
    expect(peerDl.status).toBe(403);
  });
});
