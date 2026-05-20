import { api, API_BASE_URL } from './api';
import type { Role } from './types';

export type ResourceAttachmentKind = 'DOCUMENT' | 'YOUTUBE' | 'LINK' | 'IMAGE';

export interface ResourceAttachment {
  id: string;
  kind: ResourceAttachmentKind;
  filename: string | null;
  mimetype: string | null;
  size: number | null;
  youtubeId: string | null;
  youtubeUrl: string | null;
  url: string | null;
  title: string | null;
  host: string | null;
  createdAt: string;
}

export interface Resource {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string; email: string; role: Role };
  attachments: ResourceAttachment[];
}

export interface ResourceListResponse {
  resources: Resource[];
  categories: string[];
}

export async function listResources(params?: { q?: string; category?: string }): Promise<ResourceListResponse> {
  const { data } = await api.get<ResourceListResponse>('/resources', { params });
  return data;
}

export async function createResource(input: {
  title: string;
  description?: string;
  category?: string;
}): Promise<Resource> {
  const { data } = await api.post<{ resource: Resource }>('/resources', input);
  return data.resource;
}

export async function updateResource(
  id: string,
  input: { title?: string; description?: string | null; category?: string | null },
): Promise<Resource> {
  const { data } = await api.patch<{ resource: Resource }>(`/resources/${id}`, input);
  return data.resource;
}

export async function deleteResource(id: string): Promise<void> {
  await api.delete(`/resources/${id}`);
}

export async function uploadResourceDocuments(
  id: string,
  files: File[],
): Promise<ResourceAttachment[]> {
  const form = new FormData();
  for (const f of files) form.append('files', f);
  const { data } = await api.post<{ attachments: ResourceAttachment[] }>(
    `/resources/${id}/documents`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.attachments;
}

export async function addResourceYoutube(id: string, url: string): Promise<ResourceAttachment> {
  const { data } = await api.post<{ attachment: ResourceAttachment }>(`/resources/${id}/youtube`, { url });
  return data.attachment;
}

export async function addResourceLink(
  id: string,
  url: string,
  title?: string,
): Promise<ResourceAttachment> {
  const { data } = await api.post<{ attachment: ResourceAttachment }>(`/resources/${id}/links`, {
    url,
    title,
  });
  return data.attachment;
}

export async function deleteResourceAttachment(attachmentId: string): Promise<void> {
  await api.delete(`/resources/attachments/${attachmentId}`);
}

export function resourceAttachmentDownloadUrl(attachmentId: string): string {
  return `${API_BASE_URL}/resources/attachments/${attachmentId}/file`;
}
