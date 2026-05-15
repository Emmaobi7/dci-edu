import { api } from './api';
import type {
  Assignment, AssignmentAttachment, AssignmentDetail, Submission, UpcomingAssignment,
} from './types';

export async function listAssignments(classroomId: string): Promise<Assignment[]> {
  const { data } = await api.get<{ assignments: Assignment[] }>(`/classrooms/${classroomId}/assignments`);
  return data.assignments;
}

export interface UpcomingAssignmentsResult {
  assignments: UpcomingAssignment[];
  totalPending: number;
}

export async function listMyUpcomingAssignments(limit = 5): Promise<UpcomingAssignmentsResult> {
  const { data } = await api.get<UpcomingAssignmentsResult>('/assignments/me/upcoming', {
    params: { limit },
  });
  return data;
}

export async function getAssignment(id: string): Promise<AssignmentDetail> {
  const { data } = await api.get<{ assignment: AssignmentDetail }>(`/assignments/${id}`);
  return data.assignment;
}

export async function createAssignment(
  classroomId: string,
  input: { title: string; description?: string; dueDate?: string | null },
): Promise<Assignment> {
  const { data } = await api.post<{ assignment: Assignment }>(
    `/classrooms/${classroomId}/assignments`,
    input,
  );
  return data.assignment;
}

export async function updateAssignment(
  id: string,
  input: { title?: string; description?: string | null; dueDate?: string | null },
): Promise<Assignment> {
  const { data } = await api.patch<{ assignment: Assignment }>(`/assignments/${id}`, input);
  return data.assignment;
}

export async function deleteAssignment(id: string): Promise<void> {
  await api.delete(`/assignments/${id}`);
}

export async function uploadAttachments(
  assignmentId: string,
  files: File[],
): Promise<AssignmentAttachment[]> {
  const form = new FormData();
  for (const f of files) form.append('files', f);
  const { data } = await api.post<{ attachments: AssignmentAttachment[] }>(
    `/assignments/${assignmentId}/attachments`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.attachments;
}

export async function deleteAttachment(attachmentId: string): Promise<void> {
  await api.delete(`/assignments/attachments/${attachmentId}`);
}

export function attachmentDownloadUrl(attachmentId: string): string {
  return `/api/assignments/attachments/${attachmentId}/file`;
}

export async function submitAssignment(
  assignmentId: string,
  file: File,
): Promise<Submission> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<{ submission: Submission }>(
    `/assignments/${assignmentId}/submissions`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.submission;
}

export async function listSubmissions(assignmentId: string): Promise<Submission[]> {
  const { data } = await api.get<{ submissions: Submission[] }>(
    `/assignments/${assignmentId}/submissions`,
  );
  return data.submissions;
}

export async function gradeSubmission(
  submissionId: string,
  input: { grade: number; feedback?: string },
): Promise<Submission> {
  const { data } = await api.patch<{ submission: Submission }>(
    `/assignments/submissions/${submissionId}/grade`,
    input,
  );
  return data.submission;
}

export function submissionDownloadUrl(submissionId: string): string {
  return `/api/assignments/submissions/${submissionId}/file`;
}
