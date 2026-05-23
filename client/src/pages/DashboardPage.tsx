import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, ClipboardList, ExternalLink, GraduationCap, Users, Video } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { listClassrooms } from '@/lib/classrooms';
import { listMyUpcomingAssignments, type UpcomingAssignmentsResult } from '@/lib/assignments';
import { listMyEvents } from '@/lib/events';
import { roleLabel } from '@/lib/utils';
import type { CalendarEvent, Classroom } from '@/lib/types';
import { StudentProgressSection } from '@/components/StudentProgressSection';

const SOON_MS = 15 * 60 * 1000;

type LiveStatus = 'live' | 'soon' | 'scheduled';

function liveStatus(e: CalendarEvent, now: number): LiveStatus {
  const start = new Date(e.startsAt).getTime();
  const end = e.endsAt ? new Date(e.endsAt).getTime() : start + 60 * 60 * 1000;
  if (now >= start && now <= end) return 'live';
  if (start - now > 0 && start - now <= SOON_MS) return 'soon';
  return 'scheduled';
}

function liveBadge(s: LiveStatus) {
  switch (s) {
    case 'live': return { label: 'Live now', cls: 'bg-rose-500 text-white animate-pulse' };
    case 'soon': return { label: 'Starting soon', cls: 'bg-amber-500 text-white' };
    default: return { label: 'Scheduled', cls: 'bg-sky-500/15 text-sky-700' };
  }
}

export function DashboardPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Classroom[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingAssignmentsResult | null>(null);
  const [liveSessions, setLiveSessions] = useState<CalendarEvent[]>([]);
  const [, tick] = useState(0);

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

  useEffect(() => {
    let cancelled = false;
    listMyEvents()
      .then((all) => {
        if (cancelled) return;
        const now = Date.now();
        const sessions = all
          .filter((e) => e.type === 'CLASS_SESSION')
          .filter((e) => {
            const end = e.endsAt ? new Date(e.endsAt).getTime() : new Date(e.startsAt).getTime() + 60 * 60 * 1000;
            return end >= now;
          })
          .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
          .slice(0, 3);
        setLiveSessions(sessions);
      })
      .catch(() => { /* non-fatal */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const classLabel = isTeacher ? 'My classes' : 'Enrolled classes';
  const total = classes?.length ?? 0;
  const studentTotal = classes?.reduce((acc, c) => acc + (c._count?.enrolments ?? 0), 0) ?? 0;
  const recent = (classes ?? []).slice(0, 4);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Hello, {user?.name} 👋</h1>
        <p className="text-muted-foreground mt-1">
          You are signed in as <span className="font-medium text-foreground">{roleLabel(user?.role).toLowerCase()}</span>.
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

      {liveSessions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold inline-flex items-center gap-2">
              <Video className="h-4 w-4 text-brand" /> Upcoming live classes
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/live-classes">View all <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {liveSessions.map((e) => {
              const now = Date.now();
              const s = liveStatus(e, now);
              const badge = liveBadge(s);
              const when = new Date(e.startsAt).toLocaleString(undefined, {
                weekday: 'short', month: 'short', day: 'numeric',
                hour: 'numeric', minute: '2-digit',
              });
              return (
                <Card key={e.id} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <span className="inline-block rounded-full bg-white/60 border border-white/70 text-foreground/70 px-2 py-0.5 text-[10px] font-medium">
                      {e.classroom?.name ?? 'Global'}
                    </span>
                  </div>
                  <div className="font-semibold truncate">{e.title}</div>
                  <div className="text-xs text-muted-foreground">{when}</div>
                  {e.meetingUrl && (
                    <a
                      href={e.meetingUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className={
                        'mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors w-fit ' +
                        (s === 'live' || s === 'soon'
                          ? 'bg-brand text-white hover:bg-brand/90'
                          : 'border border-white/70 bg-white/60 text-foreground hover:bg-white/90')
                      }
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Join meeting
                    </a>
                  )}
                </Card>
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
