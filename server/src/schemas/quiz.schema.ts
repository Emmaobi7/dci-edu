import { z } from 'zod';

const optionalDate = z
  .union([z.string().datetime({ offset: true }), z.string().datetime(), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v ? new Date(v) : null));

export const questionTypeSchema = z.enum(['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE']);
export type QuestionType = z.infer<typeof questionTypeSchema>;

export const questionSchema = z
  .object({
    type: questionTypeSchema,
    prompt: z.string().trim().min(1, 'Prompt is required').max(2000),
    options: z.array(z.string().trim().min(1).max(500)).min(2).max(10),
    correctIndices: z.array(z.number().int().nonnegative()).min(1),
    points: z.coerce.number().int().min(1).max(100).default(1),
  })
  .superRefine((q, ctx) => {
    const opts = q.options.length;
    for (const idx of q.correctIndices) {
      if (idx >= opts) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `correctIndices contains out-of-range index ${idx}`,
        });
        return;
      }
    }
    const unique = new Set(q.correctIndices);
    if (unique.size !== q.correctIndices.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'correctIndices must be unique',
      });
    }
    if (q.type === 'MCQ_SINGLE' && q.correctIndices.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MCQ_SINGLE must have exactly one correct option',
      });
    }
    if (q.type === 'TRUE_FALSE') {
      if (q.options.length !== 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'TRUE_FALSE must have exactly 2 options',
        });
      }
      if (q.correctIndices.length !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'TRUE_FALSE must have exactly one correct option',
        });
      }
    }
  });

export type QuizQuestion = z.infer<typeof questionSchema>;

export const createQuizSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z
    .string()
    .trim()
    .max(5000)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : undefined)),
  timeLimitMinutes: z.coerce.number().int().min(1).max(360).nullable().optional(),
  dueDate: optionalDate,
  shuffleQuestions: z.boolean().optional().default(false),
  shuffleOptions: z.boolean().optional().default(true),
  showAnswers: z.boolean().optional().default(true),
  questions: z.array(questionSchema).min(1).max(100),
});

export const updateQuizSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  timeLimitMinutes: z.coerce.number().int().min(1).max(360).nullable().optional(),
  dueDate: optionalDate,
  shuffleQuestions: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
  showAnswers: z.boolean().optional(),
  questions: z.array(questionSchema).min(1).max(100).optional(),
});

export const saveAnswersSchema = z.object({
  answers: z.record(z.string(), z.array(z.number().int().nonnegative()).max(10)),
});

export type CreateQuizInput = z.infer<typeof createQuizSchema>;
export type UpdateQuizInput = z.infer<typeof updateQuizSchema>;
export type SaveAnswersInput = z.infer<typeof saveAnswersSchema>;
