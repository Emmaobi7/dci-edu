import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma.js';
import { signToken } from '../utils/jwt.js';
import { AUTH_COOKIE, authCookieOptions, clearCookieOptions } from '../utils/cookies.js';
import { HttpError } from '../utils/HttpError.js';
import { loginSchema, registerSchema } from '../schemas/auth.schema.js';
import { toUserDto, userDtoSelect } from '../utils/userDto.js';

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
