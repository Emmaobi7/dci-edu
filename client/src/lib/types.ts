export type Role = 'ADMIN' | 'TEACHER' | 'STUDENT';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
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
}

export type ProfileField =
  | 'title'
  | 'name'
  | 'firstName'
  | 'surname'
  | 'phone'
  | 'country'
  | 'placeOfWork'
  | 'positionAtWapcp'
  | 'matriculationNumber'
  | 'topics';

export type ProfileUpdate = Partial<Record<ProfileField, string | null>>;

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
  moderatorId: string | null;
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
  mutedAt: string | null;
  isMuted: boolean;
  isModerator: boolean;
  student: { id: string; name: string; email: string };
}

export interface ChatMessage {
  id: string;
  classroomId: string;
  senderId: string;
  body: string;
  createdAt: string;
  deletedAt: string | null;
  deletedById: string | null;
  sender: { id: string; name: string };
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

export interface UpcomingAssignment {
  id: string;
  title: string;
  dueDate: string | null;
  classroomId: string;
  createdAt: string;
  classroom: { id: string; name: string };
}

export interface MyAssignment {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  classroomId: string;
  createdAt: string;
  updatedAt: string;
  classroom: { id: string; name: string };
  _count?: { submissions: number };
  mySubmission?: MySubmissionSummary | null;
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


export type AnnouncementAttachmentKind = 'IMAGE' | 'YOUTUBE' | 'DOCUMENT' | 'LINK';

export interface AnnouncementAttachment {
  id: string;
  kind: AnnouncementAttachmentKind;
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

export interface AnnouncementComment {
  id: string;
  body: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; email: string };
}

export interface Announcement {
  id: string;
  classroomId: string;
  authorId: string;
  body: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; email: string };
  attachments: AnnouncementAttachment[];
  comments: AnnouncementComment[];
}

export type NotificationType =
  | 'ANNOUNCEMENT_NEW'
  | 'ASSIGNMENT_NEW'
  | 'COMMENT_NEW'
  | 'QUIZ_NEW'
  | 'EVENT_NEW';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  classroomId: string | null;
  announcementId: string | null;
  assignmentId: string | null;
  quizId: string | null;
  eventId: string | null;
  readAt: string | null;
  createdAt: string;
  classroom: { id: string; name: string } | null;
}

export type EventType = 'EVENT' | 'CLASS_SESSION';

export interface CalendarEvent {
  id: string;
  type: EventType;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  classroomId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  classroom: { id: string; name: string } | null;
  createdBy: { id: string; name: string; email: string };
}

export type QuestionType = 'MCQ_SINGLE' | 'MCQ_MULTI' | 'TRUE_FALSE';

export interface QuizQuestionAuthor {
  type: QuestionType;
  prompt: string;
  options: string[];
  correctIndices: number[];
  points: number;
}

export interface QuizMyAttemptSummary {
  id: string;
  submittedAt: string | null;
  score: number | null;
  totalPoints: number;
  isLate: boolean;
}

export interface QuizSummary {
  id: string;
  classroomId: string;
  createdById: string;
  title: string;
  description: string | null;
  timeLimitMinutes: number | null;
  dueDate: string | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showAnswers: boolean;
  totalPoints: number;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string; email: string };
  _count?: { attempts: number };
  myAttempt?: QuizMyAttemptSummary | null;
}

export interface QuizDetail extends QuizSummary {
  questions?: QuizQuestionAuthor[];
}

export interface MyQuiz extends QuizSummary {
  classroom: { id: string; name: string };
}

export interface QuizAttemptOption {
  index: number;
  text: string;
}

export interface QuizAttemptQuestion {
  index: number;
  type: QuestionType;
  prompt: string;
  points: number;
  options: QuizAttemptOption[];
}

export interface QuizAttemptInProgress {
  id: string;
  quizId: string;
  startedAt: string;
  submittedAt: null;
  remainingSeconds: number;
  totalPoints: number;
  answers: Record<string, number[]>;
  questions: QuizAttemptQuestion[];
  quiz: {
    id: string;
    title: string;
    description: string | null;
    timeLimitMinutes: number | null;
    dueDate: string | null;
  };
}

export interface QuizAttemptResultQuestion extends QuizAttemptQuestion {
  selectedIndices: number[];
  correct: boolean;
  correctIndices?: number[];
}

export interface QuizAttemptResult {
  id: string;
  quizId: string;
  startedAt: string;
  submittedAt: string;
  isLate: boolean;
  score: number | null;
  totalPoints: number;
  showAnswers: boolean;
  questions: QuizAttemptResultQuestion[];
  quiz: { id: string; title: string; description: string | null };
  student?: { id: string; name: string; email: string };
}

export interface QuizAttemptRow {
  id: string;
  studentId: string;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  totalPoints: number;
  isLate: boolean;
  student: { id: string; name: string; email: string };
}


export interface InsightAssignmentRow {
  id: string;
  title: string;
  dueDate: string | null;
  total: number;
  submitted: number;
  completionRate: number;
  gradedCount: number;
  avgGrade: number;
  lateCount: number;
}

export interface InsightQuizRow {
  id: string;
  title: string;
  dueDate: string | null;
  totalPoints: number;
  total: number;
  submitted: number;
  attemptRate: number;
  avgPercent: number;
  lateCount: number;
}

export interface InsightStudentRow {
  id: string;
  name: string;
  email: string;
  assignmentsSubmitted: number;
  assignmentsTotal: number;
  gradedCount: number;
  avgGrade: number;
  quizzesSubmitted: number;
  quizzesTotal: number;
  avgQuizPercent: number;
  missingCount: number;
}

export interface ClassroomInsights {
  classroom: { id: string; name: string; studentCount: number };
  assignments: InsightAssignmentRow[];
  quizzes: InsightQuizRow[];
  students: InsightStudentRow[];
  totals: {
    studentCount: number;
    assignmentsTotal: number;
    quizzesTotal: number;
    avgCompletionRate: number;
    avgQuizPercent: number;
  };
}

export interface MyInsightClass {
  classroomId: string;
  name: string;
  teacherName: string;
  assignmentsTotal: number;
  assignmentsSubmitted: number;
  gradedCount: number;
  avgGrade: number;
  assignmentCompletionRate: number;
  quizzesTotal: number;
  quizzesSubmitted: number;
  avgQuizPercent: number;
  quizCompletionRate: number;
  pendingCount: number;
  overdueCount: number;
}

export interface MyInsights {
  classes: MyInsightClass[];
  totals: {
    classes: number;
    assignmentsTotal: number;
    assignmentsSubmitted: number;
    quizzesTotal: number;
    quizzesSubmitted: number;
    avgGrade: number;
    avgQuizPercent: number;
    pendingCount: number;
    overdueCount: number;
  };
}
