import { api } from './api';
import type { Classroom, ClassroomDetail, EnrolmentMember } from './types';

export async function listClassrooms(): Promise<Classroom[]> {
  const { data } = await api.get<{ classrooms: Classroom[] }>('/classrooms');
  return data.classrooms;
}

export async function getClassroom(id: string): Promise<ClassroomDetail> {
  const { data } = await api.get<{ classroom: ClassroomDetail }>(`/classrooms/${id}`);
  return data.classroom;
}

export async function createClassroom(input: { name: string; description?: string }): Promise<Classroom> {
  const { data } = await api.post<{ classroom: Classroom }>('/classrooms', input);
  return data.classroom;
}

export async function updateClassroom(
  id: string,
  input: { name?: string; description?: string | null },
): Promise<Classroom> {
  const { data } = await api.patch<{ classroom: Classroom }>(`/classrooms/${id}`, input);
  return data.classroom;
}

export async function deleteClassroom(id: string): Promise<void> {
  await api.delete(`/classrooms/${id}`);
}

export async function regenerateCode(id: string): Promise<Classroom> {
  const { data } = await api.post<{ classroom: Classroom }>(`/classrooms/${id}/regenerate-code`);
  return data.classroom;
}

export async function listMembers(id: string): Promise<EnrolmentMember[]> {
  const { data } = await api.get<{ students: EnrolmentMember[] }>(`/classrooms/${id}/students`);
  return data.students;
}

export async function removeMember(id: string, studentId: string): Promise<void> {
  await api.delete(`/classrooms/${id}/students/${studentId}`);
}

export async function joinByCode(code: string): Promise<void> {
  await api.post('/enrolments', { code });
}

export async function leaveClassroom(classroomId: string): Promise<void> {
  await api.delete(`/enrolments/${classroomId}`);
}
