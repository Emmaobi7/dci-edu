import { z } from 'zod';

export const createAnnouncementSchema = z.object({
  body: z.string().trim().min(1, 'Body is required').max(10000),
  isPinned: z.boolean().optional(),
  youtubeUrls: z.array(z.string().trim().min(1)).max(10).optional(),
});

export const updateAnnouncementSchema = z.object({
  body: z.string().trim().min(1).max(10000).optional(),
  isPinned: z.boolean().optional(),
});

export const addYoutubeSchema = z.object({
  url: z.string().trim().min(1),
});

export const addLinkSchema = z.object({
  url: z.string().trim().min(1).max(2048),
  title: z.string().trim().max(200).optional(),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, 'Comment is required').max(2000),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
export type CommentInput = z.infer<typeof commentSchema>;
export type AddLinkInput = z.infer<typeof addLinkSchema>;

/**
 * Normalize a user-supplied URL: ensures a scheme (defaults to https://) and
 * returns the parsed URL plus its hostname (lower-cased, no leading "www.").
 * Returns null if the value is not a valid http/https URL.
 */
export function normalizeLink(raw: string): { url: string; host: string } | null {
  const value = raw.trim();
  if (!value) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  if (!host) return null;
  return { url: u.toString(), host };
}

/**
 * Extract a YouTube video ID from common URL forms.
 * Returns null if the URL is not a recognised YouTube link.
 */
export function parseYoutubeId(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const idPattern = /^[A-Za-z0-9_-]{11}$/;

  if (host === 'youtu.be') {
    const id = u.pathname.replace(/^\//, '').split('/')[0] ?? '';
    return idPattern.test(id) ? id : null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (u.pathname === '/watch') {
      const v = u.searchParams.get('v') ?? '';
      return idPattern.test(v) ? v : null;
    }
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live' || parts[0] === 'v') {
      const id = parts[1] ?? '';
      return idPattern.test(id) ? id : null;
    }
  }
  return null;
}
