import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileQuestion,
  MapPin,
  Plus,
  ScrollText,
  Trash2,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EventComposer } from '@/components/EventComposer';
import { listMyAssignments } from '@/lib/assignments';
import { listMyQuizzes } from '@/lib/quizzes';
import { listClassrooms } from '@/lib/classrooms';
import { deleteEvent, listMyEvents } from '@/lib/events';
import { useAuth } from '@/lib/auth-context';
import type { CalendarEvent, Classroom, MyAssignment, MyQuiz } from '@/lib/types';

type CalKind = 'assignment' | 'exam' | 'event' | 'session';

interface CalItem {
  id: string;
  kind: CalKind;
  date: Date;
  title: string;
  className: string | null;
  classroomId: string | null;
  href: string | null;
  raw: CalendarEvent | null;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildGrid(monthStart: Date): Date[] {
  const first = monthStart;
  const lead = first.getDay();
  const start = new Date(first);
  start.setDate(first.getDate() - lead);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

function kindStyles(k: CalKind): { dot: string; bg: string; text: string; label: string } {
  switch (k) {
    case 'assignment': return { dot: 'bg-brand', bg: 'bg-brand/15', text: 'text-brand', label: 'Assignment' };
    case 'exam': return { dot: 'bg-violet-500', bg: 'bg-violet-500/15', text: 'text-violet-600', label: 'Exam' };
    case 'session': return { dot: 'bg-sky-500', bg: 'bg-sky-500/15', text: 'text-sky-600', label: 'Class session' };
    case 'event': return { dot: 'bg-emerald-500', bg: 'bg-emerald-500/15', text: 'text-emerald-600', label: 'Event' };
  }
}

function kindIcon(k: CalKind) {
  switch (k) {
    case 'assignment': return ClipboardList;
    case 'exam': return FileQuestion;
    case 'session': return Video;
    case 'event': return CalendarDays;
  }
}

export function CalendarPage() {
  const { user } = useAuth();
  const canCompose = user?.role === 'TEACHER' || user?.role === 'ADMIN';
  const canCreateGlobal = user?.role === 'ADMIN';

  const [month, setMonth] = useState<Date>(startOfMonth(new Date()));
  const [assignments, setAssignments] = useState<MyAssignment[]>([]);
  const [quizzes, setQuizzes] = useState<MyQuiz[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerDate, setComposerDate] = useState<Date | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());

  function reload() {
    setLoading(true);
    Promise.all([
      listMyAssignments().catch(() => []),
      listMyQuizzes().catch(() => []),
      listMyEvents().catch(() => []),
      canCompose ? listClassrooms().catch(() => []) : Promise.resolve([] as Classroom[]),
    ])
      .then(([a, q, e, c]) => {
        setAssignments(a);
        setQuizzes(q);
        setEvents(e);
        setClassrooms(c);
        setError(null);
      })
      .catch(() => setError('Could not load calendar'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = useMemo<CalItem[]>(() => {
    const out: CalItem[] = [];
    for (const a of assignments) {
      if (!a.dueDate) continue;
      out.push({
        id: `a-${a.id}`,
        kind: 'assignment',
        date: new Date(a.dueDate),
        title: a.title,
        className: a.classroom.name,
        classroomId: a.classroomId,
        href: `/classes/${a.classroomId}/assignments/${a.id}`,
        raw: null,
      });
    }
    for (const q of quizzes) {
      if (!q.dueDate) continue;
      out.push({
        id: `q-${q.id}`,
        kind: 'exam',
        date: new Date(q.dueDate),
        title: q.title,
        className: q.classroom.name,
        classroomId: q.classroomId,
        href: `/classes/${q.classroomId}/quizzes/${q.id}`,
        raw: null,
      });
    }
    for (const e of events) {
      out.push({
        id: `e-${e.id}`,
        kind: e.type === 'CLASS_SESSION' ? 'session' : 'event',
        date: new Date(e.startsAt),
        title: e.title,
        className: e.classroom?.name ?? null,
        classroomId: e.classroomId,
        href: null,
        raw: e,
      });
    }
    out.sort((x, y) => x.date.getTime() - y.date.getTime());
    return out;
  }, [assignments, quizzes, events]);

  const grid = useMemo(() => buildGrid(month), [month]);
  const byDay = useMemo(() => {
    const m = new Map<string, CalItem[]>();
    for (const it of items) {
      const key = `${it.date.getFullYear()}-${it.date.getMonth()}-${it.date.getDate()}`;
      const arr = m.get(key) ?? [];
      arr.push(it);
      m.set(key, arr);
    }
    return m;
  }, [items]);

  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const selectedItems = byDay.get(dayKey(selectedDay)) ?? [];

  const upcomingSessions = useMemo(() => {
    const now = Date.now();
    return events
      .filter((e) => e.type === 'CLASS_SESSION' && new Date(e.startsAt).getTime() >= now - 60 * 60 * 1000)
      .slice(0, 5);
  }, [events]);

  async function handleDelete(eventId: string) {
    if (!window.confirm('Delete this event?')) return;
    try {
      await deleteEvent(eventId);
      reload();
    } catch {
      setError('Could not delete event');
    }
  }

  const monthLabel = month.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-brand/15 text-brand grid place-items-center">
          <CalendarDays className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">Upcoming classes, assignment deadlines, exams, and events.</p>
        </div>
        {canCompose && (
          <Button onClick={() => { setComposerDate(null); setComposerOpen(true); }}>
            <Plus className="h-4 w-4 mr-1.5" /> New event
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-base font-semibold min-w-[10rem] text-center">{monthLabel}</div>
        <Button variant="ghost" size="icon" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { const t = new Date(); setMonth(startOfMonth(t)); setSelectedDay(t); }}>Today</Button>
        <div className="ml-auto flex flex-wrap gap-3 text-xs">
          {(['assignment', 'exam', 'session', 'event'] as CalKind[]).map((k) => {
            const s = kindStyles(k);
            return (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${s.dot}`} /> {s.label}
              </span>
            );
          })}
        </div>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Card className="p-0 overflow-hidden">
          <div className="grid grid-cols-7 text-xs font-medium text-muted-foreground border-b border-border/60">
            {weekdays.map((w) => <div key={w} className="px-2 py-2 text-center">{w}</div>)}
          </div>
          <div className="grid grid-cols-7 auto-rows-fr">
            {grid.map((d, idx) => {
              const inMonth = d.getMonth() === month.getMonth();
              const isToday = sameDay(d, new Date());
              const isSelected = sameDay(d, selectedDay);
              const dayItems = byDay.get(dayKey(d)) ?? [];
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedDay(d)}
                  onDoubleClick={() => { if (canCompose) { setComposerDate(d); setComposerOpen(true); } }}
                  className={`relative border-t border-l border-border/40 first:border-l-0 min-h-[5.5rem] p-1.5 text-left transition ${
                    inMonth ? '' : 'bg-muted/30 text-muted-foreground'
                  } ${isSelected ? 'ring-2 ring-brand/60 z-10' : 'hover:bg-white/40'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium ${isToday ? 'h-5 w-5 rounded-full bg-brand text-white grid place-items-center' : ''}`}>
                      {d.getDate()}
                    </span>
                    {dayItems.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">+{dayItems.length - 3}</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {dayItems.slice(0, 3).map((it) => {
                      const s = kindStyles(it.kind);
                      return (
                        <span
                          key={it.id}
                          className={`truncate text-[10.5px] leading-tight px-1.5 py-0.5 rounded ${s.bg} ${s.text}`}
                          title={`${s.label}: ${it.title}`}
                        >
                          {it.title}
                        </span>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{selectedDay.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
              {canCompose && (
                <Button size="sm" variant="ghost" onClick={() => { setComposerDate(selectedDay); setComposerOpen(true); }}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              )}
            </div>
            {selectedItems.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
            )}
            <ul className="flex flex-col gap-2">
              {selectedItems.map((it) => {
                const Icon = kindIcon(it.kind);
                const s = kindStyles(it.kind);
                const time = it.date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
                const inner = (
                  <div className="flex items-start gap-3">
                    <div className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 ${s.bg} ${s.text}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{it.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {time}{it.className ? ` · ${it.className}` : it.raw && !it.raw.classroomId ? ' · Global' : ''}
                      </div>
                      {it.raw?.location && (
                        <div className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" /> {it.raw.location}
                        </div>
                      )}
                    </div>
                    {it.raw && canCompose && (it.raw.classroomId == null ? canCreateGlobal : true) && (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(it.raw!.id); }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                        aria-label="Delete event"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
                return (
                  <li key={it.id} className="group rounded-lg border border-border/50 p-2 hover:bg-white/40">
                    {it.href ? <Link to={it.href}>{inner}</Link> : inner}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <h3 className="font-semibold mb-2 inline-flex items-center gap-2"><Video className="h-4 w-4 text-sky-600" /> Upcoming classes</h3>
            {upcomingSessions.length === 0 && (
              <p className="text-sm text-muted-foreground">No upcoming class sessions.</p>
            )}
            <ul className="flex flex-col gap-2">
              {upcomingSessions.map((e) => {
                const d = new Date(e.startsAt);
                return (
                  <li key={e.id} className="text-sm">
                    <div className="font-medium truncate">{e.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      {e.classroom ? ` · ${e.classroom.name}` : ' · Global'}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <h3 className="font-semibold mb-1 inline-flex items-center gap-2"><ScrollText className="h-4 w-4 text-violet-600" /> Next deadlines</h3>
            <ul className="flex flex-col gap-2 mt-1">
              {items.filter((it) => (it.kind === 'assignment' || it.kind === 'exam') && it.date.getTime() >= Date.now())
                .slice(0, 5)
                .map((it) => {
                  const Icon = kindIcon(it.kind);
                  const s = kindStyles(it.kind);
                  return (
                    <li key={it.id} className="text-sm">
                      <Link to={it.href ?? '#'} className="inline-flex items-center gap-2">
                        <Icon className={`h-3.5 w-3.5 ${s.text}`} />
                        <span className="font-medium truncate">{it.title}</span>
                      </Link>
                      <div className="text-xs text-muted-foreground ml-5.5">
                        {it.date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        {it.className ? ` · ${it.className}` : ''}
                      </div>
                    </li>
                  );
                })}
              {items.filter((it) => (it.kind === 'assignment' || it.kind === 'exam') && it.date.getTime() >= Date.now()).length === 0 && (
                <li className="text-sm text-muted-foreground">No upcoming deadlines.</li>
              )}
            </ul>
          </Card>
        </div>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}

      {composerOpen && (
        <EventComposer
          open={composerOpen}
          onClose={() => setComposerOpen(false)}
          onCreated={reload}
          classrooms={classrooms.filter((c) => user?.role === 'ADMIN' || c.teacherId === user?.id)}
          canCreateGlobal={canCreateGlobal}
          initialDate={composerDate}
        />
      )}
    </div>
  );
}
