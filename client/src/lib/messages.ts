import { api } from './api';
import type { ChatMessage } from './types';

export async function listMessages(
  classroomId: string,
  opts: { before?: string; limit?: number } = {},
): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  const params: Record<string, string | number> = {};
  if (opts.before) params.before = opts.before;
  if (opts.limit) params.limit = opts.limit;
  const { data } = await api.get<{ messages: ChatMessage[]; hasMore: boolean }>(
    `/classrooms/${classroomId}/messages`,
    { params },
  );
  return data;
}

export async function deleteMessage(id: string): Promise<ChatMessage> {
  const { data } = await api.delete<{ message: ChatMessage }>(`/messages/${id}`);
  return data.message;
}

export async function muteStudent(classroomId: string, studentId: string): Promise<void> {
  await api.post(`/classrooms/${classroomId}/students/${studentId}/mute`);
}

export async function unmuteStudent(classroomId: string, studentId: string): Promise<void> {
  await api.post(`/classrooms/${classroomId}/students/${studentId}/unmute`);
}

export async function promoteModerator(classroomId: string, studentId: string): Promise<void> {
  await api.post(`/classrooms/${classroomId}/students/${studentId}/promote`);
}

export async function demoteModerator(classroomId: string): Promise<void> {
  await api.post(`/classrooms/${classroomId}/moderator/demote`);
}
