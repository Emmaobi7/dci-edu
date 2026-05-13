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
  opts: { name: string; email: string; role?: 'TEACHER' | 'STUDENT' },
) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({
    name: opts.name,
    email: opts.email,
    password: TEST_PASSWORD,
    role: opts.role ?? 'STUDENT',
  });
  if (res.status !== 201) {
    throw new Error(`registerAgent failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { agent, user: res.body.user as { id: string; email: string; name: string; role: string } };
}

export async function cleanupByTag(tag: string) {
  // Order matters with Neon if cascade is off; we set onDelete cascade so deleting users is enough
  await prisma.user.deleteMany({ where: { email: { contains: tag } } });
}
