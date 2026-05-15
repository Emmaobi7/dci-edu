import { api } from './api';
import type { Announcement, AnnouncementAttachment, AnnouncementComment } from './types';

export interface ListAnnouncementsResult {
  announcements: Announcement[];
  hasMore: boolean;
}

export async function listAnnouncements(
  classroomId: string,
  opts: { take?: number; skip?: number } = {},
): Promise<ListAnnouncementsResult> {
  const { data } = await api.get<ListAnnouncementsResult>(
    `/classrooms/${classroomId}/announcements`,
    { params: { take: opts.take ?? 10, skip: opts.skip ?? 0 } },
  );
  return data;
}

export async function createAnnouncement(
  classroomId: string,
  input: { body: string; isPinned?: boolean; youtubeUrls?: string[] },
): Promise<Announcement> {
  const { data } = await api.post<{ announcement: Announcement }>(
    `/classrooms/${classroomId}/announcements`,
    input,
  );
  return data.announcement;
}

export async function updateAnnouncement(
  id: string,
  input: { body?: string; isPinned?: boolean },
): Promise<Announcement> {
  const { data } = await api.patch<{ announcement: Announcement }>(`/announcements/${id}`, input);
  return data.announcement;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await api.delete(`/announcements/${id}`);
}

export async function uploadAnnouncementImages(
  announcementId: string,
  files: File[],
): Promise<AnnouncementAttachment[]> {
  const form = new FormData();
  for (const f of files) form.append('files', f);
  const { data } = await api.post<{ attachments: AnnouncementAttachment[] }>(
    `/announcements/${announcementId}/images`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.attachments;
}

export async function addYoutubeAttachment(
  announcementId: string,
  url: string,
): Promise<AnnouncementAttachment> {
  const { data } = await api.post<{ attachment: AnnouncementAttachment }>(
    `/announcements/${announcementId}/youtube`,
    { url },
  );
  return data.attachment;
}

export async function deleteAnnouncementAttachment(attachmentId: string): Promise<void> {
  await api.delete(`/announcements/attachments/${attachmentId}`);
}

export function announcementImageUrl(attachmentId: string): string {
  return `/api/announcements/attachments/${attachmentId}/file`;
}

export async function createComment(
  announcementId: string,
  body: string,
): Promise<AnnouncementComment> {
  const { data } = await api.post<{ comment: AnnouncementComment }>(
    `/announcements/${announcementId}/comments`,
    { body },
  );
  return data.comment;
}

export async function updateComment(
  commentId: string,
  body: string,
): Promise<AnnouncementComment> {
  const { data } = await api.patch<{ comment: AnnouncementComment }>(
    `/announcements/comments/${commentId}`,
    { body },
  );
  return data.comment;
}

export async function deleteComment(commentId: string): Promise<void> {
  await api.delete(`/announcements/comments/${commentId}`);
}
