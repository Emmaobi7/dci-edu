import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PublicOnlyRoute } from '@/components/PublicOnlyRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ClassesPage } from '@/pages/ClassesPage';
import { ClassroomDetailPage } from '@/pages/ClassroomDetailPage';
import { AssignmentDetailPage } from '@/pages/AssignmentDetailPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { QuizDetailPage } from '@/pages/QuizDetailPage';
import { TeacherAttemptPage } from '@/pages/TeacherAttemptPage';
import { LiveClassesPage } from '@/pages/LiveClassesPage';
import { AssessmentPage } from '@/pages/AssessmentPage';
import { ExamsPage } from '@/pages/ExamsPage';
import { CalendarPage } from '@/pages/CalendarPage';
import { ResourcesPage } from '@/pages/ResourcesPage';
import { HelpPage } from '@/pages/HelpPage';
import { UsersPage } from '@/pages/UsersPage';
import { AdminPage } from '@/pages/AdminPage';
import { AdminClassesPage } from '@/pages/AdminClassesPage';
import { AuditPage } from '@/pages/AuditPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/classes" element={<ClassesPage />} />
              <Route path="/classes/:id" element={<ClassroomDetailPage />} />
              <Route path="/classes/:classId/assignments/:id" element={<AssignmentDetailPage />} />
              <Route path="/classes/:classId/quizzes/:id" element={<QuizDetailPage />} />
              <Route path="/classes/:classId/quizzes/:id/attempts/:attemptId" element={<TeacherAttemptPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/live-classes" element={<LiveClassesPage />} />
              <Route path="/assessment" element={<AssessmentPage />} />
              <Route path="/exams" element={<ExamsPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/resources" element={<ResourcesPage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route element={<ProtectedRoute roles={['ADMIN']} />}>
                <Route path="/users" element={<UsersPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin/classes" element={<AdminClassesPage />} />
                <Route path="/admin/audit" element={<AuditPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
