export type Role = 'ADMIN' | 'TEACHER' | 'STUDENT';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface TeacherSummary {
  id: string;
  name: string;
  email: string;
}

export interface Classroom {
  id: string;
  name: string;
  description: string | null;
  code?: string;
  teacherId: string;
  teacher: TeacherSummary;
  createdAt: string;
  updatedAt: string;
  joinedAt?: string;
  _count?: { enrolments: number };
}

export interface ClassroomDetail extends Classroom {
  studentCount: number;
}

export interface EnrolmentMember {
  id: string;
  joinedAt: string;
  student: { id: string; name: string; email: string };
}

export interface AssignmentAttachment {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
  createdAt: string;
}

export interface MySubmissionSummary {
  id: string;
  filename?: string;
  mimetype?: string;
  size?: number;
  isLate: boolean;
  submittedAt: string;
  updatedAt?: string;
  grade: number | null;
  feedback: string | null;
  gradedAt: string | null;
}

export interface Assignment {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  classroomId: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  attachments: AssignmentAttachment[];
  createdBy: { id: string; name: string; email: string };
  _count?: { submissions: number };
  mySubmission?: MySubmissionSummary | null;
}

export interface AssignmentDetail extends Assignment {
  submissionCount?: number;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  filename: string;
  mimetype: string;
  size: number;
  isLate: boolean;
  grade: number | null;
  feedback: string | null;
  gradedAt: string | null;
  submittedAt: string;
  updatedAt: string;
  student: { id: string; name: string; email: string };
  gradedBy: { id: string; name: string } | null;
}
