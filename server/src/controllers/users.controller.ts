import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../utils/HttpError.js';
import { toUserDto, userDtoSelect } from '../utils/userDto.js';
import {
  adminCreateUserSchema,
  listUsersQuerySchema,
  resetUserPasswordSchema,
  updateUserRoleSchema,
} from '../schemas/users.schema.js';
import { writeAudit } from '../utils/audit.js';
import { parseCsv, toCsv } from '../utils/csv.js';
import { randomBytes } from 'node:crypto';

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
  disabledAt: true,
  firstName: true,
  surname: true,
  title: true,
  phone: true,
  country: true,
  placeOfWork: true,
  positionAtWapcp: true,
  registrationNumber: true,
  topics: true,
  avatarStoredName: true,
  profileSubmittedAt: true,
  degreeCertificateStoredName: true,
  degreeCertificateOriginalName: true,
  practiceLicenseStoredName: true,
  practiceLicenseOriginalName: true,
  passportPhotoStoredName: true,
  passportPhotoOriginalName: true,
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

  await writeAudit({
    action: 'USER_ROLE_CHANGED',
    actorId: admin.id,
    targetUserId: targetId,
    targetType: 'User',
    targetId,
    summary: `${updated.email}: ${target.role} → ${role}`,
    metadata: { previousRole: target.role, newRole: role },
  });

  res.json({ user: toAdminUserDto(updated) });
}

export async function adminCreateUser(req: Request, res: Response): Promise<void> {
  const admin = requireAdmin(req);
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

  await writeAudit({
    action: 'USER_CREATED',
    actorId: admin.id,
    targetUserId: created.id,
    targetType: 'User',
    targetId: created.id,
    summary: `Created ${data.role.toLowerCase()} ${created.email}`,
    metadata: { role: data.role },
  });

  res.status(201).json({ user: toAdminUserDto(created) });
}

export async function resetUserPassword(req: Request, res: Response): Promise<void> {
  const admin = requireAdmin(req);
  const { id: targetId } = req.params as { id: string };
  const { password } = resetUserPasswordSchema.parse(req.body);

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, email: true },
  });
  if (!target) throw new HttpError(404, 'User not found');

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id: targetId }, data: { passwordHash } });

  await writeAudit({
    action: 'USER_PASSWORD_RESET',
    actorId: admin.id,
    targetUserId: targetId,
    targetType: 'User',
    targetId,
    summary: `Reset password for ${target.email}`,
  });

  res.json({ ok: true });
}

export async function disableUser(req: Request, res: Response): Promise<void> {
  const admin = requireAdmin(req);
  const { id: targetId } = req.params as { id: string };
  if (targetId === admin.id) throw new HttpError(400, 'You cannot suspend yourself');

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, email: true, disabledAt: true },
  });
  if (!target) throw new HttpError(404, 'User not found');

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: { disabledAt: target.disabledAt ?? new Date() },
    select: adminUserSelect,
  });

  if (!target.disabledAt) {
    await writeAudit({
      action: 'USER_DISABLED',
      actorId: admin.id,
      targetUserId: targetId,
      targetType: 'User',
      targetId,
      summary: `Suspended ${target.email}`,
    });
  }

  res.json({ user: toAdminUserDto(updated) });
}

export async function enableUser(req: Request, res: Response): Promise<void> {
  const admin = requireAdmin(req);
  const { id: targetId } = req.params as { id: string };

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, email: true, disabledAt: true },
  });
  if (!target) throw new HttpError(404, 'User not found');

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: { disabledAt: null },
    select: adminUserSelect,
  });

  if (target.disabledAt) {
    await writeAudit({
      action: 'USER_ENABLED',
      actorId: admin.id,
      targetUserId: targetId,
      targetType: 'User',
      targetId,
      summary: `Reactivated ${target.email}`,
    });
  }

  res.json({ user: toAdminUserDto(updated) });
}

export async function exportUsersCsv(req: Request, res: Response): Promise<void> {
  requireAdmin(req);
  const users = await prisma.user.findMany({
    orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    select: {
      email: true,
      role: true,
      name: true,
      firstName: true,
      surname: true,
      title: true,
      phone: true,
      country: true,
      placeOfWork: true,
      positionAtWapcp: true,
      registrationNumber: true,
      topics: true,
      disabledAt: true,
      createdAt: true,
    },
  });

  const header = [
    'email', 'role', 'name', 'firstName', 'surname', 'title', 'phone',
    'country', 'placeOfWork', 'positionAtWapcp', 'registrationNumber',
    'topics', 'disabled', 'createdAt',
  ];
  const rows: (string | null)[][] = [header];
  for (const u of users) {
    rows.push([
      u.email, u.role, u.name, u.firstName, u.surname, u.title, u.phone,
      u.country, u.placeOfWork, u.positionAtWapcp, u.registrationNumber,
      u.topics, u.disabledAt ? 'true' : 'false', u.createdAt.toISOString(),
    ]);
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
  res.send(toCsv(rows));
}

interface ImportResultRow { row: number; email?: string; message: string }
interface ImportSummary {
  created: number;
  skipped: number;
  errors: ImportResultRow[];
}

function generatePassword(): string {
  return randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12);
}

export async function importUsersCsv(req: Request, res: Response): Promise<void> {
  const admin = requireAdmin(req);
  const file = req.file;
  if (!file) throw new HttpError(400, 'CSV file is required');

  const rows = parseCsv(file.buffer.toString('utf8'));
  if (rows.length === 0) throw new HttpError(400, 'CSV is empty');

  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const emailIdx = idx('email');
  const roleIdx = idx('role');
  const nameIdx = idx('name');
  const firstNameIdx = idx('firstname');
  const surnameIdx = idx('surname');
  const passwordIdx = idx('password');
  if (emailIdx < 0 || roleIdx < 0) {
    throw new HttpError(400, 'CSV must include at least "email" and "role" columns');
  }

  const summary: ImportSummary = { created: 0, skipped: 0, errors: [] };
  const createdUsers: { email: string; role: 'STUDENT' | 'TEACHER' | 'ADMIN' }[] = [];

  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r]!;
    const rowNo = r + 1;
    const email = (cols[emailIdx] ?? '').trim().toLowerCase();
    const roleRaw = (cols[roleIdx] ?? '').trim().toUpperCase();
    if (!email) { summary.skipped++; continue; }
    if (!['STUDENT', 'TEACHER', 'ADMIN'].includes(roleRaw)) {
      summary.errors.push({ row: rowNo, email, message: `Invalid role "${roleRaw}"` });
      continue;
    }
    const role = roleRaw as 'STUDENT' | 'TEACHER' | 'ADMIN';
    const firstName = firstNameIdx >= 0 ? (cols[firstNameIdx] ?? '').trim() : '';
    const surname = surnameIdx >= 0 ? (cols[surnameIdx] ?? '').trim() : '';
    let name = nameIdx >= 0 ? (cols[nameIdx] ?? '').trim() : '';
    if (!name) name = `${firstName} ${surname}`.replace(/\s+/g, ' ').trim();
    if (!name) {
      summary.errors.push({ row: rowNo, email, message: 'Missing name' });
      continue;
    }
    const password = passwordIdx >= 0 && cols[passwordIdx]
      ? cols[passwordIdx]!.trim()
      : generatePassword();
    if (password.length < 8) {
      summary.errors.push({ row: rowNo, email, message: 'Password must be at least 8 characters' });
      continue;
    }

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) { summary.skipped++; continue; }

    try {
      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.user.create({
        data: {
          email,
          passwordHash,
          role,
          name,
          firstName: role === 'STUDENT' ? (firstName || null) : null,
          surname: role === 'STUDENT' ? (surname || null) : null,
        },
      });
      summary.created++;
      createdUsers.push({ email, role });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      summary.errors.push({ row: rowNo, email, message: msg });
    }
  }

  if (summary.created > 0) {
    await writeAudit({
      action: 'USER_IMPORTED',
      actorId: admin.id,
      summary: `Imported ${summary.created} user(s) from CSV`,
      metadata: { created: summary.created, skipped: summary.skipped, errors: summary.errors.length },
    });
  }

  res.json(summary);
}
