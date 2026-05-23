import { useState, type ComponentType } from 'react';
import {
  Bell, BookOpen, CalendarDays, ChevronDown, ClipboardList, FileSpreadsheet,
  GraduationCap, LayoutDashboard, LifeBuoy, Library, School, Shield, UserCircle2, Users, Video,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import { roleLabel } from '@/lib/utils';
import type { Role } from '@/lib/types';

interface Topic {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
}

const STUDENT_TOPICS: Topic[] = [
  { icon: LayoutDashboard, title: 'Dashboard', body: 'Your home view: upcoming assignments and exams, sessions starting soon, and the classes you are enrolled in. Use the quick cards to jump straight into a class or open an item.' },
  { icon: BookOpen, title: 'Classes', body: 'See every class you are enrolled in. To join a new class, click "Join class" and enter the 6-character code your faculty shared. Inside a class you will find announcements, assignments, exams, resources, and members.' },
  { icon: Video, title: 'Live Classes', body: 'See sessions that are live right now or scheduled. Click "Join" on a live session to open the meeting in a new tab. Sessions are created by faculty on the Calendar.' },
  { icon: Bell, title: 'Notifications', body: 'Inbox for new announcements, new assignments, grades, and comments. The bell icon in the top bar shows the unread count; the page lets you mark individual or all items as read.' },
  { icon: ClipboardList, title: 'Assessment', body: 'One page with two tabs: Assignments and Exams. Filter by Pending, Overdue, Submitted, or Graded. Click an item to open it, upload your submission (PDF/DOC/DOCX), and see your grade once a faculty has marked it.' },
  { icon: CalendarDays, title: 'Calendar', body: 'A month view of due dates and live sessions across every class you are enrolled in. Click any item for details. Read-only — only faculty add events.' },
  { icon: Library, title: 'Resources', body: 'Reference materials your faculty has shared (documents, links, videos). Browse and download — your faculty controls what is published.' },
  { icon: UserCircle2, title: 'Profile', body: 'Click your name in the top bar to manage your profile. Upload an avatar, set your country and matriculation number, and change your password. Keep your matriculation number accurate — it appears on your submissions.' },
];

const TEACHER_TOPICS: Topic[] = [
  { icon: LayoutDashboard, title: 'Dashboard', body: 'Snapshot of the classes you teach: enrolment counts, upcoming sessions, and items needing attention (ungraded submissions, drafts). Click any class card to open it.' },
  { icon: BookOpen, title: 'Classes', body: 'Create classes with "New class". Each class has a join code under the Members tab — share it with students. Inside a class you can post announcements, create assignments and exams, upload resources, and remove members.' },
  { icon: Video, title: 'Live Classes', body: 'See your scheduled and active sessions. Sessions are created from the Calendar — pick a date, choose "Live class", and paste the meeting link. Students see them in their own Live Classes view.' },
  { icon: Bell, title: 'Notifications', body: 'Replies on your announcements, new submissions, and grade requests land here. Use it to triage what needs your attention next.' },
  { icon: ClipboardList, title: 'Assessment', body: 'From within a class, create assignments (file upload + due date) and exams (quiz questions). Filter the global Assessment page by status to find ungraded submissions across all your classes. Open a submission to download, grade, and leave feedback.' },
  { icon: CalendarDays, title: 'Calendar', body: 'The "+ New event" button creates due dates, live classes, or general events on a chosen class. Drag/click any cell to compose. Events are visible to that class\'s students immediately.' },
  { icon: Library, title: 'Resources', body: 'Upload documents, paste links, or embed videos for any class you own. Resources are pinned to the class until you delete them. Use this for syllabi, reading lists, and references.' },
  { icon: GraduationCap, title: 'Students', body: 'A directory of every student enrolled in any class you own. Click a student to see their profile, submissions per class, and grade history. Use it for quick at-a-glance progress checks.' },
  { icon: UserCircle2, title: 'Profile', body: 'Manage your faculty profile from the top bar. Set your title (Dr., Prof., etc.), country, place of work, position, and topics you teach. These show on your announcements and student-facing views.' },
];

const ADMIN_TOPICS: Topic[] = [
  { icon: LayoutDashboard, title: 'Dashboard', body: 'Platform overview. As an admin you do not see student/class-specific dashboards — your focus is the user base and audit trail.' },
  { icon: Users, title: 'Users', body: 'The user directory. Create accounts (any role) with "+ New user", promote/demote between Student, Faculty, and Admin, suspend or reactivate accounts, and reset passwords. Bulk-create accounts via CSV import.' },
  { icon: School, title: 'All classes', body: 'Every class on the platform, regardless of owner. Use to audit, reassign, or delete classes when faculty leave.' },
  { icon: FileSpreadsheet, title: 'Audit log', body: 'Read-only history of sensitive actions: role changes, suspensions, password resets, deletions. Filter by user, action, or date range to investigate incidents.' },
  { icon: Shield, title: 'Admin', body: 'Bootstrap and platform settings. The first admin is provisioned via env (BOOTSTRAP_ADMIN_*); subsequent admins are promoted from the Users page.' },
  { icon: Video, title: 'Live Classes', body: 'Read-only view of every live or scheduled session. Useful for spot-checks; admins do not own classes and so do not create sessions.' },
  { icon: CalendarDays, title: 'Calendar', body: 'Global calendar view of all live classes and major events across the platform.' },
  { icon: Library, title: 'Resources', body: 'Browse resources uploaded by faculty across all classes. Remove anything that violates policy.' },
  { icon: UserCircle2, title: 'Profile', body: 'Your own admin profile. Manage your name, avatar, and password from the top bar.' },
];

function topicsFor(role: Role | undefined | null): Topic[] {
  if (role === 'TEACHER') return TEACHER_TOPICS;
  if (role === 'ADMIN') return ADMIN_TOPICS;
  return STUDENT_TOPICS;
}

function TopicCard({ topic }: { topic: Topic }) {
  const [open, setOpen] = useState(false);
  const Icon = topic.icon;
  return (
    <Card className="overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/40"
      >
        <div className="h-9 w-9 shrink-0 rounded-xl bg-brand/15 text-brand grid place-items-center">
          <Icon className="h-4 w-4" />
        </div>
        <span className="flex-1 font-medium">{topic.title}</span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="border-t border-white/40 px-4 py-3 text-sm text-foreground/80">
          {topic.body}
        </div>
      )}
    </Card>
  );
}

export function HelpPage() {
  const { user } = useAuth();
  const role = user?.role ?? 'STUDENT';
  const topics = topicsFor(role);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-brand/15 text-brand grid place-items-center">
          <LifeBuoy className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Help &amp; Guide</h1>
          <p className="text-sm text-muted-foreground">
            How to use WAPCPharm Classroom as a {roleLabel(role).toLowerCase() || 'user'}. Tap any topic to expand.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {topics.map((t) => (
          <TopicCard key={t.title} topic={t} />
        ))}
      </div>

      <Card className="p-4">
        <h3 className="font-semibold">Need more help?</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {role === 'STUDENT'
            ? 'Contact your faculty for class-specific questions, or reach an administrator for account and access issues.'
            : role === 'TEACHER'
              ? 'For account, role, or platform questions contact an administrator. For class-specific support, your students should contact you directly.'
              : 'You are the top of the support chain — coordinate with the platform owner or developer for anything beyond user management and audit review.'}
        </p>
      </Card>
    </div>
  );
}
