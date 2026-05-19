import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../utils/HttpError.js';
import { toUserDto, userDtoSelect } from '../utils/userDto.js';
import {
  adminCreateUserSchema,
  listUsersQuerySchema,
  updateUserRoleSchema,
} from '../schemas/users.schema.js';

function requireAdmin(req: Request) {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  if (req.user.role !== 'ADMIN') throw new HttpError(403, 'Admin only');
  return req.user;
}

const adminUserSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  email: true,
  name: true,
  role: true,
  firstName: true,
  surname: true,
  title: true,
  phone: true,
  country: true,
  placeOfWork: true,
  positionAtWapcp: true,
  matriculationNumber: true,
  topics: true,
  avatarStoredName: true,
  createdAt: true,
  _count: { select: { ownedClassrooms: true, enrolments: true } },
});

type AdminUserRecord = Prisma.UserGetPayload<{ select: typeof adminUserSelect }>;

function toAdminUserDto(u: AdminUserRecord) {
  return {
    ...toUserDto(u),
    createdAt: u.createdAt.toISOString(),
    ownedClassroomCount: u._count.ownedClassrooms,
    enrolmentCount: u._count.enrolments,
  };
}

export async function listUsers(req: Request, res: Response): Promise<void> {
  requireAdmin(req);
  const { q, role } = listUsersQuerySchema.parse(req.query);

  const where: Prisma.UserWhereInput = {};
  if (role) where.role = role;
  if (q) {
    where.OR = [
      { email: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
      { firstName: { contains: q, mode: 'insensitive' } },
      { surname: { contains: q, mode: 'insensitive' } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    select: adminUserSelect,
    take: 500,
  });

  res.json({ users: users.map(toAdminUserDto) });
}

export async function updateUserRole(req: Request, res: Response): Promise<void> {
  const admin = requireAdmin(req);
  const { id: targetId } = req.params as { id: string };
  if (!targetId) throw new HttpError(400, 'User id is required');
  if (targetId === admin.id) {
    throw new HttpError(400, 'You cannot change your own role');
  }

  const { role } = updateUserRoleSchema.parse(req.body);

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, role: true },
  });
  if (!target) throw new HttpError(404, 'User not found');
  if (target.role === role) {
    const user = await prisma.user.findUnique({
      where: { id: targetId },
      select: adminUserSelect,
    });
    res.json({ user: user ? toAdminUserDto(user) : null });
    return;
  }

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: { role },
    select: adminUserSelect,
  });

  res.json({ user: toAdminUserDto(updated) });
}

export async function adminCreateUser(req: Request, res: Response): Promise<void> {
  requireAdmin(req);
  const data = adminCreateUserSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new HttpError(409, 'Email already registered');

  const passwordHash = await bcrypt.hash(data.password, 12);
  const name =
    data.role === 'STUDENT'
      ? `${data.firstName} ${data.surname}`.replace(/\s+/g, ' ').trim()
      : (data.name as string);

  const created = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      role: data.role,
      name,
      firstName: data.role === 'STUDENT' ? data.firstName ?? null : null,
      surname: data.role === 'STUDENT' ? data.surname ?? null : null,
    },
    select: adminUserSelect,
  });

  res.status(201).json({ user: toAdminUserDto(created) });
}
