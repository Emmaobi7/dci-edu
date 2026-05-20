import { api } from './api';

export interface AdminStats {
  users: {
    total: number;
    students: number;
    faculty: number;
    admins: number;
    disabled: number;
    signups7d: number;
    signups30d: number;
  };
  classrooms: number;
  assignments: number;
  exams: number;
  events: number;
  topClasses: {
    id: string;
    name: string;
    teacher: { id: string; name: string } | null;
    studentCount: number;
  }[];
}

export async function getAdminStats(): Promise<AdminStats> {
  const { data } = await api.get<{ stats: AdminStats }>('/admin/stats');
  return data.stats;
}

export type AuditAction =
  | 'USER_CREATED'
  | 'USER_ROLE_CHANGED'
  | 'USER_PASSWORD_RESET'
  | 'USER_DISABLED'
  | 'USER_ENABLED'
  | 'USER_IMPORTED'
  | 'CLASSROOM_DELETED';

export interface AuditEvent {
  id: string;
  action: AuditAction;
  summary: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
  targetUser: { id: string; name: string; email: string } | null;
}

export async function listAuditEvents(limit = 200): Promise<AuditEvent[]> {
  const { data } = await api.get<{ events: AuditEvent[] }>('/admin/audit', {
    params: { limit },
  });
  return data.events;
}

export interface AdminClassroom {
  id: string;
  name: string;
  description: string | null;
  code: string;
  createdAt: string;
  updatedAt: string;
  teacher: { id: string; name: string; email: string };
  _count: { enrolments: number; assignments: number; quizzes: number };
}

export async function listAdminClassrooms(): Promise<AdminClassroom[]> {
  const { data } = await api.get<{ classrooms: AdminClassroom[] }>('/admin/classrooms');
  return data.classrooms;
}
