import { api } from './api';
import type { ClassroomInsights, MyInsights } from './types';

export async function getClassroomInsights(classroomId: string): Promise<ClassroomInsights> {
  const { data } = await api.get<ClassroomInsights>(`/classrooms/${classroomId}/insights`);
  return data;
}

export async function getMyInsights(): Promise<MyInsights> {
  const { data } = await api.get<MyInsights>('/me/insights');
  return data;
}
