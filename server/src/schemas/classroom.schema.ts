import { z } from 'zod';

export const createClassroomSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  description: z.string().trim().max(2000).optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
});

export const updateClassroomSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
});

export const joinByCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(4)
    .max(16)
    .regex(/^[A-Z2-9]+$/i, 'Invalid class code'),
});

export type CreateClassroomInput = z.infer<typeof createClassroomSchema>;
export type UpdateClassroomInput = z.infer<typeof updateClassroomSchema>;
export type JoinByCodeInput = z.infer<typeof joinByCodeSchema>;
