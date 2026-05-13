import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '../db/prisma.js';

const app = createApp();

// Unique tag per test run so we can scope cleanup and avoid collisions
const TEST_TAG = `vitest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const emailFor = (k: string) => `${k}+${TEST_TAG}@test.dev`;
const PASSWORD = 'longenoughpassword';

// Wake Neon (serverless Postgres auto-suspends; the first cold request can fail)
async function warmDatabase(attempts = 5): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (err) {
      if (i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

beforeAll(async () => {
  await warmDatabase();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: TEST_TAG } } });
  await prisma.$disconnect();
});

describe('POST /api/auth/register', () => {
  it('rejects invalid input with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('registers a TEACHER and sets an httpOnly cookie', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Alice',
      email: emailFor('alice'),
      password: PASSWORD,
      role: 'TEACHER',
    });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Alice', role: 'TEACHER' });
    expect(res.body.user).not.toHaveProperty('passwordHash');

    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    const auth = cookies.find((c) => c.startsWith('wapcharm_token='));
    expect(auth).toBeDefined();
    expect(auth).toMatch(/HttpOnly/i);
  });

  it('refuses an admin role via public registration', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Hacker',
      email: emailFor('admin'),
      password: PASSWORD,
      role: 'ADMIN',
    });
    expect(res.status).toBe(400);
  });

  it('refuses duplicate email with 409', async () => {
    const email = emailFor('dup');
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'D', email, password: PASSWORD });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'D2', email, password: PASSWORD });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  it('rejects wrong password with 401', async () => {
    const email = emailFor('wrong');
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'W', email, password: PASSWORD });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'definitely-not-it' });
    expect(res.status).toBe(401);
  });

  it('returns user + cookie on success', async () => {
    const email = emailFor('login');
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'L', email, password: PASSWORD });
    const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    expect(cookies.some((c) => c.startsWith('wapcharm_token='))).toBe(true);
  });
});

describe('GET /api/auth/me', () => {
  it('is 401 without a cookie', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user when authenticated', async () => {
    const email = emailFor('me');
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'M', email, password: PASSWORD });
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the cookie and subsequent /me returns 401', async () => {
    const email = emailFor('logout');
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'O', email, password: PASSWORD });

    const out = await agent.post('/api/auth/logout');
    expect(out.status).toBe(204);

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(401);
  });
});
