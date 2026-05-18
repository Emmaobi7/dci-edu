import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Clock, FileQuestion, Hourglass, ScrollText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { listMyQuizzes } from '@/lib/quizzes';
import { useAuth } from '@/lib/auth-context';
import type { MyQuiz } from '@/lib/types';

type FilterKey = 'all' | 'pending' | 'submitted' | 'overdue';

export function ExamsPage() {
  const { user } = useAuth();
  const isStudent = user?.role === 'STUDENT';
  const [items, setItems] = useState<MyQuiz[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [classFilter, setClassFilter] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    listMyQuizzes()
      .then((rows) => { if (!cancelled) setItems(rows); })
      .catch(() => { if (!cancelled) setError('Could not load your exams'); });
    return () => { cancelled = true; };
  }, []);

  const classes = useMemo(() => {
    const map = new Map<string, string>();
    (items ?? []).forEach((q) => map.set(q.classroom.id, q.classroom.name));
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter((q) => {
      if (classFilter !== 'all' && q.classroom.id !== classFilter) return false;
      if (filter === 'all') return true;
      const att = q.myAttempt;
      const overdue = !!(q.dueDate && !att?.submittedAt && new Date(q.dueDate).getTime() < Date.now());
      if (filter === 'pending') return !att?.submittedAt && !overdue;
      if (filter === 'overdue') return overdue;
      if (filter === 'submitted') return !!att?.submittedAt;
      return true;
    });
  }, [items, filter, classFilter]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-brand/15 text-brand grid place-items-center">
          <ScrollText className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Exams</h1>
          <p className="text-sm text-muted-foreground">
            {isStudent ? 'Exams across your classes.' : 'Exams you have posted across your classes.'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(isStudent
          ? (['all', 'pending', 'overdue', 'submitted'] as FilterKey[])
          : (['all'] as FilterKey[])
        ).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`px-3 py-1.5 text-xs rounded-full border transition ${filter === k ? 'bg-brand text-white border-brand' : 'bg-transparent border-border hover:bg-muted'}`}
          >
            {filterLabel(k)}
          </button>
        ))}
        {classes.length > 1 && (
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="ml-auto h-8 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="all">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
      {items === null && !error && <div className="text-sm text-muted-foreground">Loading…</div>}
      {items && filtered.length === 0 && (
        <Card className="text-center py-10">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-brand/15 text-brand grid place-items-center mb-3">
            <ScrollText className="h-6 w-6" />
          </div>
          <h3 className="font-semibold">Nothing here yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            {filter === 'all' ? 'No exams posted across your classes.' : 'No items match this filter.'}
          </p>
        </Card>
      )}

      {items && filtered.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((q) => <QuizRow key={q.id} q={q} isStudent={isStudent} />)}
        </div>
      )}
    </div>
  );
}

function filterLabel(k: FilterKey): string {
  switch (k) {
    case 'all': return 'All';
    case 'pending': return 'Pending';
    case 'submitted': return 'Submitted';
    case 'overdue': return 'Overdue';
  }
}

function QuizRow({ q, isStudent }: { q: MyQuiz; isStudent: boolean }) {
  const att = q.myAttempt;
  const overdue = !!(q.dueDate && !att?.submittedAt && new Date(q.dueDate).getTime() < Date.now());
  const status = isStudent
    ? att?.submittedAt
      ? att.score != null
        ? { label: `Score · ${att.score}/${att.totalPoints}`, tone: 'success' as const, icon: CheckCircle2 }
        : { label: att.isLate ? 'Submitted (late)' : 'Submitted', tone: 'muted' as const, icon: CheckCircle2 }
      : overdue
        ? { label: 'Overdue', tone: 'destructive' as const, icon: Clock }
        : { label: 'Pending', tone: 'brand' as const, icon: Clock }
    : { label: `${q._count?.attempts ?? 0} attempt${q._count?.attempts === 1 ? '' : 's'}`, tone: 'muted' as const, icon: CheckCircle2 };
  const tone = status.tone === 'destructive' ? 'bg-destructive/15 text-destructive'
    : status.tone === 'success' ? 'bg-emerald-500/15 text-emerald-600'
    : status.tone === 'brand' ? 'bg-brand/15 text-brand'
    : 'bg-muted text-muted-foreground';

  return (
    <Link to={`/classes/${q.classroomId}/quizzes/${q.id}`} className="group">
      <Card className="transition-transform group-hover:-translate-y-0.5 group-hover:shadow-glass-lg">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand/15 text-brand grid place-items-center shrink-0">
            <FileQuestion className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate">{q.title}</div>
            <div className="text-xs text-muted-foreground truncate">{q.classroom.name}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {q.dueDate && (
                <span className={`inline-flex items-center gap-1 ${overdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                  <CalendarClock className="h-3.5 w-3.5" />
                  {new Date(q.dueDate).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>
              )}
              {q.timeLimitMinutes && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Hourglass className="h-3.5 w-3.5" /> {q.timeLimitMinutes} min
                </span>
              )}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${tone}`}>
                <status.icon className="h-3.5 w-3.5" /> {status.label}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
