import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma.js';
import { signToken } from '../utils/jwt.js';
import { AUTH_COOKIE, authCookieOptions, clearCookieOptions } from '../utils/cookies.js';
import { HttpError } from '../utils/HttpError.js';
import { loginSchema, registerSchema } from '../schemas/auth.schema.js';

function toPublicUser(u: { id: string; email: string; name: string; role: 'ADMIN' | 'TEACHER' | 'STUDENT' }) {
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password, role } = registerSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new HttpError(409, 'Email already registered');

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role },
    select: { id: true, email: true, name: true, role: true },
  });

  const token = signToken({ sub: user.id, role: user.role });
  res.cookie(AUTH_COOKIE, token, authCookieOptions);
  res.status(201).json({ user: toPublicUser(user) });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new HttpError(401, 'Invalid email or password');

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new HttpError(401, 'Invalid email or password');

  const token = signToken({ sub: user.id, role: user.role });
  res.cookie(AUTH_COOKIE, token, authCookieOptions);
  res.json({ user: toPublicUser(user) });
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie(AUTH_COOKIE, clearCookieOptions);
  res.status(204).end();
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!user) throw new HttpError(401, 'Not authenticated');
  res.json({ user: toPublicUser(user) });
}
