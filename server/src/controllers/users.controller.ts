import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/HttpError.js';
import { toUserDto, userDtoSelect } from '../utils/userDto.js';
import {
  adminCreateUserSchema,
  listUsersQuerySchema,
  resetUserPasswordSchema,
  updateUserClearanceSchema,
  updateUserRoleSchema,
} from '../schemas/users.schema.js';
import { writeAudit } from '../utils/audit.js';
import { parseCsv, toCsv } from '../utils/csv.js';
import { randomBytes } from 'node:crypto';

function defaultPasswordForRole(role: 'STUDENT' | 'TEACHER' | 'ADMIN'): string {
  if (role === 'STUDENT') return env.DEFAULT_STUDENT_PASSWORD;
  if (role === 'TEACHER') return env.DEFAULT_FACULTY_PASSWORD;
  return generatePassword();
}

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
  clearance: true,
  clearanceRemark: true,
  clearanceUpdatedAt: true,
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

  const usedDefaultPassword = !data.password;
  const password = data.password ?? defaultPasswordForRole(data.role);
  const passwordHash = await bcrypt.hash(password, 12);
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
    metadata: { role: data.role, defaultPassword: usedDefaultPassword },
  });

  res.status(201).json({ user: toAdminUserDto(created) });
}

export async function updateUserClearance(req: Request, res: Response): Promise<void> {
  const admin = requireAdmin(req);
  const { id: targetId } = req.params as { id: string };
  if (!targetId) throw new HttpError(400, 'User id is required');
  const { status, remark } = updateUserClearanceSchema.parse(req.body);

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, email: true, role: true, clearance: true },
  });
  if (!target) throw new HttpError(404, 'User not found');
  if (target.role !== 'STUDENT') {
    throw new HttpError(400, 'Clearance only applies to student accounts');
  }

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: {
      clearance: status,
      clearanceRemark: remark?.trim() ? remark.trim() : null,
      clearanceUpdatedAt: new Date(),
      clearanceUpdatedById: admin.id,
    },
    select: adminUserSelect,
  });

  await writeAudit({
    action: 'USER_CLEARANCE_UPDATED',
    actorId: admin.id,
    targetUserId: targetId,
    targetType: 'User',
    targetId,
    summary: `${target.email}: ${target.clearance} → ${status}`,
    metadata: { previous: target.clearance, next: status, hasRemark: !!remark?.trim() },
  });

  res.json({ user: toAdminUserDto(updated) });
}

export async function reopenStudentProfile(req: Request, res: Response): Promise<void> {
  const admin = requireAdmin(req);
  const { id: targetId } = req.params as { id: string };
  if (!targetId) throw new HttpError(400, 'User id is required');

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, email: true, role: true, profileSubmittedAt: true },
  });
  if (!target) throw new HttpError(404, 'User not found');
  if (target.role !== 'STUDENT') {
    throw new HttpError(400, 'Only student profiles can be reopened');
  }
  if (!target.profileSubmittedAt) {
    throw new HttpError(400, 'This profile has not been submitted yet');
  }

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: { profileSubmittedAt: null },
    select: adminUserSelect,
  });

  await writeAudit({
    action: 'USER_PROFILE_REOPENED',
    actorId: admin.id,
    targetUserId: targetId,
    targetType: 'User',
    targetId,
    summary: `Reopened profile for ${target.email}`,
    metadata: { previousSubmittedAt: target.profileSubmittedAt.toISOString() },
  });

  res.json({ user: toAdminUserDto(updated) });
}

export async function getFacultyBio(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  const { userId } = req.params as { userId: string };
  if (!userId) throw new HttpError(400, 'User id is required');

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, role: true, name: true, title: true, topics: true,
      country: true, placeOfWork: true, positionAtWapcp: true,
      avatarStoredName: true,
    },
  });
  if (!target || target.role !== 'TEACHER') {
    throw new HttpError(404, 'Faculty member not found');
  }

  res.json({
    bio: {
      id: target.id,
      name: target.name,
      title: target.title,
      topics: target.topics,
      country: target.country,
      placeOfWork: target.placeOfWork,
      positionAtWapcp: target.positionAtWapcp,
      avatarUrl: target.avatarStoredName
        ? `/users/${target.id}/avatar?v=${target.avatarStoredName.slice(0, 12)}`
        : null,
    },
  });
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
      clearance: true,
      clearanceRemark: true,
      clearanceUpdatedAt: true,
    },
  });

  const header = [
    'email', 'role', 'name', 'firstName', 'surname', 'title', 'phone',
    'country', 'placeOfWork', 'positionAtWapcp', 'registrationNumber',
    'topics', 'disabled', 'createdAt',
    'clearance', 'clearanceRemark', 'clearanceUpdatedAt',
  ];
  const rows: (string | null)[][] = [header];
  for (const u of users) {
    rows.push([
      u.email, u.role, u.name, u.firstName, u.surname, u.title, u.phone,
      u.country, u.placeOfWork, u.positionAtWapcp, u.registrationNumber,
      u.topics, u.disabledAt ? 'true' : 'false', u.createdAt.toISOString(),
      u.role === 'STUDENT' ? u.clearance : '',
      u.role === 'STUDENT' ? u.clearanceRemark : '',
      u.role === 'STUDENT' && u.clearanceUpdatedAt ? u.clearanceUpdatedAt.toISOString() : '',
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
  // Accept both new and legacy column names for back-compat with older exports.
  const registrationIdx = (() => {
    const a = idx('registrationnumber');
    if (a >= 0) return a;
    return idx('matriculationnumber');
  })();
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
    const passwordCell = passwordIdx >= 0 ? (cols[passwordIdx] ?? '').trim() : '';
    // When the CSV supplies a password, enforce the standard minimum. When blank,
    // fall back to the role-based default (which may be shorter by design).
    const password = passwordCell || defaultPasswordForRole(role);
    if (passwordCell && passwordCell.length < 8) {
      summary.errors.push({ row: rowNo, email, message: 'Password must be at least 8 characters' });
      continue;
    }
    const registrationNumber = registrationIdx >= 0
      ? (cols[registrationIdx] ?? '').trim()
      : '';

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) { summary.skipped++; continue; }

    if (role === 'STUDENT' && registrationNumber) {
      const dupe = await prisma.user.findFirst({
        where: { registrationNumber },
        select: { id: true },
      });
      if (dupe) {
        summary.errors.push({
          row: rowNo, email,
          message: `Registration number "${registrationNumber}" is already in use`,
        });
        continue;
      }
    }

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
          registrationNumber: role === 'STUDENT' ? (registrationNumber || null) : null,
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
