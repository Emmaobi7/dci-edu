import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../db/prisma.js';

export const TEST_PASSWORD = 'longenoughpassword';

export const makeEmailFactory = (tag: string) => (k: string) => `${k}+${tag}@test.dev`;

export async function warmDatabase(attempts = 5): Promise<void> {
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

export async function registerAgent(
  app: Express,
  opts: { name: string; email: string; role?: 'TEACHER' | 'STUDENT' | 'ADMIN' },
) {
  const agent = request.agent(app);
  const role = opts.role ?? 'STUDENT';
  const [firstName, ...rest] = opts.name.split(/\s+/);
  const surname = rest.join(' ') || 'Student';
  const payload = {
    firstName: firstName ?? opts.name,
    surname,
    email: opts.email,
    password: TEST_PASSWORD,
  };
  const res = await agent.post('/api/auth/register').send(payload);
  if (res.status !== 201) {
    throw new Error(`registerAgent failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  let user = res.body.user as { id: string; email: string; name: string; role: string };
  if (role !== 'STUDENT') {
    // Auth register always creates STUDENTs; promote via DB then re-login so the
    // JWT cookie reflects the new role.
    await prisma.user.update({ where: { id: user.id }, data: { role } });
    const loginRes = await agent
      .post('/api/auth/login')
      .send({ email: opts.email, password: TEST_PASSWORD });
    if (loginRes.status !== 200) {
      throw new Error(`registerAgent re-login failed: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
    }
    user = loginRes.body.user as { id: string; email: string; name: string; role: string };
  }
  return { agent, user };
}

export async function cleanupByTag(tag: string) {
  // Order matters with Neon if cascade is off; we set onDelete cascade so deleting users is enough
  await prisma.user.deleteMany({ where: { email: { contains: tag } } });
}
