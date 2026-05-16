import { api } from './api';
import type { ProfileUpdate, User } from './types';

export async function getMyProfile(): Promise<User> {
  const { data } = await api.get<{ user: User }>('/me/profile');
  return data.user;
}

export async function updateMyProfile(patch: ProfileUpdate): Promise<User> {
  const { data } = await api.patch<{ user: User }>('/me/profile', patch);
  return data.user;
}

export async function getClassroomStudentProfile(classroomId: string, studentId: string): Promise<User> {
  const { data } = await api.get<{ user: User }>(
    `/classrooms/${classroomId}/students/${studentId}/profile`,
  );
  return data.user;
}

export async function uploadAvatar(file: File): Promise<User> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<{ user: User }>('/me/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.user;
}

export async function deleteAvatar(): Promise<User> {
  const { data } = await api.delete<{ user: User }>('/me/avatar');
  return data.user;
}
