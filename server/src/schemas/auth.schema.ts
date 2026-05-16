import { z } from 'zod';

export const registerSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    firstName: z.string().trim().min(1).max(60).optional(),
    surname: z.string().trim().min(1).max(60).optional(),
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    role: z.enum(['TEACHER', 'STUDENT']).default('STUDENT'),
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

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
