import { z } from 'zod';

export const createResourceSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(4000).optional(),
  category: z.string().trim().max(80).optional(),
});

export const updateResourceSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  category: z.string().trim().max(80).nullable().optional(),
});

export const addResourceYoutubeSchema = z.object({
  url: z.string().trim().min(1),
});

export const addResourceLinkSchema = z.object({
  url: z.string().trim().min(1).max(2048),
  title: z.string().trim().max(200).optional(),
});

export const listResourcesQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.string().trim().max(80).optional(),
});

export type CreateResourceInput = z.infer<typeof createResourceSchema>;
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;
