import { z } from 'zod';

const optionalDate = z
  .union([z.string().datetime({ offset: true }), z.string().datetime(), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v ? new Date(v) : null));

export const createAssignmentSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z
    .string()
    .trim()
    .max(5000)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : undefined)),
  dueDate: optionalDate,
});

export const updateAssignmentSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  dueDate: optionalDate,
});

export const gradeSubmissionSchema = z.object({
  grade: z.coerce.number().int().min(0).max(100),
  feedback: z
    .string()
    .trim()
    .max(5000)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : undefined)),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;
