import { api } from './api';
import type { Role } from './types';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  disabledAt: string | null;
  firstName: string | null;
  surname: string | null;
  title: string | null;
  phone: string | null;
  country: string | null;
  placeOfWork: string | null;
  positionAtWapcp: string | null;
  matriculationNumber: string | null;
  topics: string | null;
  avatarUrl: string | null;
  createdAt: string;
  ownedClassroomCount: number;
  enrolmentCount: number;
}

export interface ListUsersQuery {
  q?: string;
  role?: Role;
}

export async function listUsers(query: ListUsersQuery = {}): Promise<AdminUser[]> {
  const params: Record<string, string> = {};
  if (query.q) params.q = query.q;
  if (query.role) params.role = query.role;
  const { data } = await api.get<{ users: AdminUser[] }>('/users', { params });
  return data.users;
}

export async function updateUserRole(id: string, role: Role): Promise<AdminUser> {
  const { data } = await api.patch<{ user: AdminUser }>(`/users/${id}/role`, { role });
  return data.user;
}

export type AdminCreateUserInput =
  | { role: 'STUDENT'; email: string; password: string; firstName: string; surname: string }
  | { role: 'TEACHER' | 'ADMIN'; email: string; password: string; name: string };

export async function adminCreateUser(input: AdminCreateUserInput): Promise<AdminUser> {
  const { data } = await api.post<{ user: AdminUser }>('/users', input);
  return data.user;
}

export async function resetUserPassword(id: string, password: string): Promise<void> {
  await api.post(`/users/${id}/password`, { password });
}

export async function disableUser(id: string): Promise<AdminUser> {
  const { data } = await api.post<{ user: AdminUser }>(`/users/${id}/disable`);
  return data.user;
}

export async function enableUser(id: string): Promise<AdminUser> {
  const { data } = await api.post<{ user: AdminUser }>(`/users/${id}/enable`);
  return data.user;
}

export interface ImportSummary {
  created: number;
  skipped: number;
  errors: { row: number; email?: string; message: string }[];
}

export async function importUsersCsv(file: File): Promise<ImportSummary> {
  const fd = new FormData();
  fd.append('file', file);
  const { data } = await api.post<ImportSummary>('/users/import', fd);
  return data;
}
