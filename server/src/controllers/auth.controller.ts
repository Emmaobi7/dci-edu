import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { signToken } from '../utils/jwt.js';
import { AUTH_COOKIE, authCookieOptions, clearCookieOptions } from '../utils/cookies.js';
import { HttpError } from '../utils/HttpError.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '../schemas/auth.schema.js';
import { toUserDto, userDtoSelect } from '../utils/userDto.js';
import { sendPasswordResetEmail } from '../utils/email.js';

const PASSWORD_RESET_TTL_MINUTES = 30;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function register(req: Request, res: Response): Promise<void> {
  const data = registerSchema.parse(req.body);
  const { email, password, firstName, surname } = data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new HttpError(409, 'Email already registered');

  const passwordHash = await bcrypt.hash(password, 12);
  const name = `${firstName} ${surname}`.replace(/\s+/g, ' ').trim();

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: 'STUDENT',
      firstName,
      surname,
    },
    select: userDtoSelect,
  });

  const token = signToken({ sub: user.id, role: user.role });
  res.cookie(AUTH_COOKIE, token, authCookieOptions);
  res.status(201).json({ user: toUserDto(user) });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new HttpError(401, 'Invalid email or password');

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new HttpError(401, 'Invalid email or password');

  if (user.disabledAt) {
    throw new HttpError(403, 'This account has been suspended. Contact an administrator.');
  }

  const token = signToken({ sub: user.id, role: user.role });
  res.cookie(AUTH_COOKIE, token, authCookieOptions);
  res.json({ user: toUserDto(user) });
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie(AUTH_COOKIE, clearCookieOptions);
  res.status(204).end();
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: userDtoSelect,
  });
  if (!user) throw new HttpError(401, 'Not authenticated');
  res.json({ user: toUserDto(user) });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = forgotPasswordSchema.parse(req.body);

  // Always respond the same way to avoid email enumeration.
  const genericResponse = { ok: true } as const;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, disabledAt: true },
  });
  if (!user || user.disabledAt) {
    res.json(genericResponse);
    return;
  }

  // Invalidate any unused, unexpired tokens for this user before issuing a new one.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });

  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const resetUrl = `${env.APP_BASE_URL.replace(/\/$/, '')}/reset-password?token=${rawToken}`;
  await sendPasswordResetEmail(user.email, user.name, resetUrl, PASSWORD_RESET_TTL_MINUTES);

  res.json(genericResponse);
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, password } = resetPasswordSchema.parse(req.body);
  const tokenHash = hashToken(token);

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      usedAt: true,
      expiresAt: true,
      user: { select: { id: true, disabledAt: true } },
    },
  });
  if (!record || record.usedAt || record.expiresAt < new Date() || !record.user) {
    throw new HttpError(400, 'This reset link is invalid or has expired');
  }
  if (record.user.disabledAt) {
    throw new HttpError(403, 'This account has been suspended. Contact an administrator.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Invalidate any other outstanding tokens for this user.
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null, id: { not: record.id } },
      data: { usedAt: new Date() },
    }),
  ]);

  res.json({ ok: true });
}
