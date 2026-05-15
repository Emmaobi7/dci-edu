import { z } from 'zod';

export const messageBodySchema = z.object({
  body: z.string().transform((v) => v.trim()).pipe(z.string().min(1, 'Message cannot be empty').max(2000)),
});

export type MessageBodyInput = z.infer<typeof messageBodySchema>;
