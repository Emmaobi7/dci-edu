import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';

export async function bootstrapAdmin(): Promise<void> {
  const email = env.BOOTSTRAP_ADMIN_EMAIL;
  const password = env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) return;

  const name = env.BOOTSTRAP_ADMIN_NAME?.trim() || 'Administrator';

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: { email, name, passwordHash, role: 'ADMIN' },
      select: { id: true },
    });
    // eslint-disable-next-line no-console
    console.log(`[bootstrap] created admin account ${email}`);
    return;
  }

  if (existing.role !== 'ADMIN') {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: 'ADMIN' },
    });
    // eslint-disable-next-line no-console
    console.log(`[bootstrap] promoted existing user ${email} to ADMIN`);
  }
}
