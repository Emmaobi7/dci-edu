import { CalendarDays, ClipboardList, FileQuestion, Megaphone, MessageCircle } from 'lucide-react';
import type { NotificationItem, NotificationType } from '@/lib/types';

export function notificationTargetPath(n: NotificationItem): string | null {
  if (n.assignmentId && n.classroomId) {
    return `/classes/${n.classroomId}/assignments/${n.assignmentId}`;
  }
  if (n.quizId && n.classroomId) {
    return `/classes/${n.classroomId}/quizzes/${n.quizId}`;
  }
  if (n.eventId) {
    return '/calendar';
  }
  if (n.classroomId) {
    return `/classes/${n.classroomId}`;
  }
  return null;
}

export function notificationIconFor(type: NotificationType) {
  switch (type) {
    case 'ANNOUNCEMENT_NEW': return Megaphone;
    case 'ASSIGNMENT_NEW': return ClipboardList;
    case 'COMMENT_NEW': return MessageCircle;
    case 'QUIZ_NEW': return FileQuestion;
    case 'EVENT_NEW': return CalendarDays;
    default: return Megaphone;
  }
}
