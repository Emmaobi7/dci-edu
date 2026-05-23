import { z } from 'zod';

const requiredDate = z.union([
  z.string().datetime({ offset: true }),
  z.string().datetime(),
]).transform((v) => new Date(v));

const optionalDate = z
  .union([z.string().datetime({ offset: true }), z.string().datetime(), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v ? new Date(v) : null));

export const eventTypeSchema = z.enum(['EVENT', 'CLASS_SESSION']);

const nullableTrimmedString = (max: number) =>
  z
    .union([z.string().trim().max(max), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v ? v : null));

const nullableUrl = z
  .union([z.string().trim().url('Must be a valid URL').max(2000), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

export const createEventSchema = z
  .object({
    type: eventTypeSchema.optional().default('EVENT'),
    title: z.string().trim().min(1, 'Title is required').max(200),
    description: nullableTrimmedString(5000),
    location: nullableTrimmedString(200),
    meetingUrl: nullableUrl,
    startsAt: requiredDate,
    endsAt: optionalDate,
    classroomId: z
      .union([z.string().min(1), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v ? v : null)),
  })
  .superRefine((data, ctx) => {
    if (data.endsAt && data.endsAt.getTime() < data.startsAt.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endsAt'],
        message: 'End must be after start',
      });
    }
  });

export const updateEventSchema = z
  .object({
    type: eventTypeSchema.optional(),
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    location: z.string().trim().max(200).nullable().optional(),
    meetingUrl: nullableUrl,
    startsAt: z
      .union([z.string().datetime({ offset: true }), z.string().datetime()])
      .optional()
      .transform((v) => (v ? new Date(v) : undefined)),
    endsAt: optionalDate,
  })
  .superRefine((data, ctx) => {
    if (data.startsAt && data.endsAt && data.endsAt.getTime() < data.startsAt.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endsAt'],
        message: 'End must be after start',
      });
    }
  });

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
