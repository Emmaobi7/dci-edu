import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, ClipboardList, GraduationCap, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { listClassrooms } from '@/lib/classrooms';
import { listMyUpcomingAssignments, type UpcomingAssignmentsResult } from '@/lib/assignments';
import type { Classroom } from '@/lib/types';
import { StudentProgressSection } from '@/components/StudentProgressSection';

export function DashboardPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Classroom[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingAssignmentsResult | null>(null);

  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';
  const isStudent = user?.role === 'STUDENT';

  useEffect(() => {
    let cancelled = false;
    listClassrooms()
      .then((cs) => { if (!cancelled) setClasses(cs); })
      .catch(() => { if (!cancelled) setError('Could not load your classes'); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isStudent) return;
    let cancelled = false;
    listMyUpcomingAssignments(5)
      .then((u) => { if (!cancelled) setUpcoming(u); })
      .catch(() => { /* non-fatal */ });
    return () => { cancelled = true; };
  }, [isStudent]);

  const classLabel = isTeacher ? 'My classes' : 'Enrolled classes';
  const total = classes?.length ?? 0;
  const studentTotal = classes?.reduce((acc, c) => acc + (c._count?.enrolments ?? 0), 0) ?? 0;
  const recent = (classes ?? []).slice(0, 4);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Hello, {user?.name} 👋</h1>
        <p className="text-muted-foreground mt-1">
          You are signed in as <span className="font-medium text-foreground">{user?.role.toLowerCase()}</span>.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{classLabel}</CardTitle>
            <CardDescription>{isTeacher ? 'Classes you teach.' : 'Classes you have joined.'}</CardDescription>
          </CardHeader>
          <div className="flex items-end justify-between">
            <div className="text-3xl font-semibold text-brand">{classes === null ? '—' : total}</div>
            <BookOpen className="h-6 w-6 text-brand/60" />
          </div>
        </Card>
        {isTeacher && (
          <Card>
            <CardHeader>
              <CardTitle>Total students</CardTitle>
              <CardDescription>Across all your classes.</CardDescription>
            </CardHeader>
            <div className="flex items-end justify-between">
              <div className="text-3xl font-semibold text-brand">{classes === null ? '—' : studentTotal}</div>
              <Users className="h-6 w-6 text-brand/60" />
            </div>
          </Card>
        )}
        {isStudent && (
          <Card>
            <CardHeader>
              <CardTitle>Assignments due</CardTitle>
              <CardDescription>Pending across your classes.</CardDescription>
            </CardHeader>
            <div className="flex items-end justify-between">
              <div className="text-3xl font-semibold text-brand">
                {upcoming === null ? '—' : upcoming.totalPending}
              </div>
              <ClipboardList className="h-6 w-6 text-brand/60" />
            </div>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Role</CardTitle>
            <CardDescription>Your account permissions.</CardDescription>
          </CardHeader>
          <div className="flex items-end justify-between">
            <div className="text-lg font-semibold capitalize">{user?.role.toLowerCase()}</div>
            <GraduationCap className="h-6 w-6 text-brand/60" />
          </div>
        </Card>
      </div>

      {isStudent && <StudentProgressSection />}

      {isStudent && upcoming && upcoming.assignments.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Due soon</h2>
            {upcoming.totalPending > upcoming.assignments.length && (
              <span className="text-xs text-muted-foreground">
                Showing {upcoming.assignments.length} of {upcoming.totalPending}
              </span>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.assignments.map((a) => {
              const overdue = !!(a.dueDate && new Date(a.dueDate).getTime() < Date.now());
              return (
                <Link
                  key={a.id}
                  to={`/classes/${a.classroomId}/assignments/${a.id}`}
                  className="group"
                >
                  <Card className="transition-transform group-hover:-translate-y-0.5 group-hover:shadow-glass-lg">
                    <div className="flex items-start gap-3">
                      <div className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${overdue ? 'bg-destructive/15 text-destructive' : 'bg-brand/15 text-brand'}`}>
                        <ClipboardList className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate">{a.title}</div>
                        <div className="text-xs text-muted-foreground truncate">{a.classroom.name}</div>
                        <div className="text-xs mt-1">
                          {a.dueDate ? (
                            <span className={overdue ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                              {overdue ? 'Overdue · ' : 'Due '}
                              {new Date(a.dueDate).toLocaleString(undefined, {
                                month: 'short', day: 'numeric',
                                hour: 'numeric', minute: '2-digit',
                              })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">No due date</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recent classes</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/classes">View all <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
        {classes === null && !error && <div className="text-sm text-muted-foreground">Loading…</div>}
        {classes && recent.length === 0 && (
          <Card>
            <p className="text-sm text-muted-foreground">
              {isTeacher ? 'No classes yet — create your first one.' : 'You have not joined any classes yet.'}
            </p>
            <div className="mt-3">
              <Button asChild><Link to="/classes">Go to classes</Link></Button>
            </div>
          </Card>
        )}
        {classes && recent.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {recent.map((c) => (
              <Link key={c.id} to={`/classes/${c.id}`} className="group">
                <Card className="transition-transform group-hover:-translate-y-0.5 group-hover:shadow-glass-lg">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-brand/15 text-brand grid place-items-center shrink-0">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.teacher.name}</div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
