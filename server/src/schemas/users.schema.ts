import { z } from 'zod';

export const updateUserRoleSchema = z.object({
  role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']),
});

export const listUsersQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']).optional(),
});

export const resetUserPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const adminCreateUserSchema = z
  .object({
    role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']),
    email: z.string().trim().toLowerCase().email(),
    // Optional: when blank, the controller assigns the role-based default password.
    password: z.string().min(8, 'Password must be at least 8 characters').max(128).optional(),
    name: z.string().trim().min(1).max(100).optional(),
    firstName: z.string().trim().min(1).max(60).optional(),
    surname: z.string().trim().min(1).max(60).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'STUDENT') {
      if (!data.firstName || !data.surname) {
        ctx.addIssue({
          code: 'custom',
          path: ['firstName'],
          message: 'First name and surname are required for student accounts',
        });
      }
    } else if (!data.name) {
      ctx.addIssue({ code: 'custom', path: ['name'], message: 'Name is required' });
    }
  });

export const updateUserClearanceSchema = z.object({
  status: z.enum(['CLEARED', 'NOT_CLEARED']),
  remark: z.string().trim().max(1000).optional().nullable(),
});
