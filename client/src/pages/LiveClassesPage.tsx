import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Pencil, Plus, Trash2, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import { deleteEvent, listMyEvents } from '@/lib/events';
import { listClassrooms } from '@/lib/classrooms';
import type { CalendarEvent, Classroom } from '@/lib/types';
import { LiveClassDialog } from '@/components/LiveClassDialog';

type Status = 'live' | 'soon' | 'scheduled' | 'past';

const SOON_MS = 15 * 60 * 1000;

function statusOf(e: CalendarEvent, now = Date.now()): Status {
  const start = new Date(e.startsAt).getTime();
  const end = e.endsAt ? new Date(e.endsAt).getTime() : start + 60 * 60 * 1000;
  if (now >= start && now <= end) return 'live';
  if (start - now > 0 && start - now <= SOON_MS) return 'soon';
  if (now > end) return 'past';
  return 'scheduled';
}

function statusBadge(s: Status) {
  switch (s) {
    case 'live': return { label: 'Live now', cls: 'bg-rose-500 text-white animate-pulse' };
    case 'soon': return { label: 'Starting soon', cls: 'bg-amber-500 text-white' };
    case 'past': return { label: 'Ended', cls: 'bg-muted text-muted-foreground' };
    default: return { label: 'Scheduled', cls: 'bg-sky-500/15 text-sky-700' };
  }
}

function formatWhen(iso: string, endIso: string | null): string {
  const d = new Date(iso);
  const datePart = d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const timePart = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (!endIso) return `${datePart} · ${timePart}`;
  const end = new Date(endIso);
  const endTime = end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${datePart} · ${timePart} – ${endTime}`;
}

export function LiveClassesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CalendarEvent | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  async function reload() {
    try {
      const all = await listMyEvents();
      setEvents(all.filter((e) => e.type === 'CLASS_SESSION'));
      setError(null);
    } catch {
      setError('Could not load live classes');
    }
  }

  useEffect(() => {
    reload();
    if (isAdmin) listClassrooms().then(setClassrooms).catch(() => undefined);
  }, [isAdmin]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up: CalendarEvent[] = [];
    const pa: CalendarEvent[] = [];
    for (const e of events ?? []) {
      const s = statusOf(e, now);
      if (s === 'past') pa.push(e); else up.push(e);
    }
    up.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    pa.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
    return { upcoming: up, past: pa };
  }, [events]);

  const visible = tab === 'upcoming' ? upcoming : past;

  async function onDelete(e: CalendarEvent) {
    if (!window.confirm(`Cancel "${e.title}"?`)) return;
    try {
      await deleteEvent(e.id);
      setEvents((arr) => (arr ?? []).filter((x) => x.id !== e.id));
    } catch {
      setError('Could not cancel live class');
    }
  }

  function onSaved(saved: CalendarEvent) {
    if (saved.type !== 'CLASS_SESSION') { reload(); return; }
    setEvents((arr) => {
      const list = arr ?? [];
      const exists = list.some((x) => x.id === saved.id);
      return exists ? list.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...list];
    });
    setEditTarget(null);
    setDialogOpen(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-brand/15 text-brand grid place-items-center">
            <Video className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Live Classes</h1>
            <p className="text-sm text-muted-foreground">
              Scheduled Google Meet sessions for faculty and students.
            </p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditTarget(null); setDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Schedule live class
          </Button>
        )}
      </div>

      <div className="flex gap-1 border-b border-foreground/10">
        {([
          { id: 'upcoming', label: `Upcoming (${upcoming.length})` },
          { id: 'past', label: `Past (${past.length})` },
        ] as const).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ' +
              (tab === t.id ? 'border-brand text-brand' : 'border-transparent text-muted-foreground hover:text-foreground')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
      {!events && !error && <div className="text-sm text-muted-foreground">Loading…</div>}

      {events && visible.length === 0 && (
        <Card className="text-center py-12">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-brand/15 text-brand grid place-items-center mb-3">
            <Video className="h-6 w-6" />
          </div>
          <h3 className="font-semibold">
            {tab === 'upcoming' ? 'No live classes scheduled' : 'No past live classes'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            {tab === 'upcoming'
              ? (isAdmin ? 'Tap "Schedule live class" to add a Google Meet session.' : 'Check back later — admins will post sessions here.')
              : 'Past sessions will appear here once they end.'}
          </p>
        </Card>
      )}

      {events && visible.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((e) => (
            <LiveClassCard
              key={e.id}
              event={e}
              isAdmin={isAdmin}
              onEdit={() => { setEditTarget(e); setDialogOpen(true); }}
              onDelete={() => onDelete(e)}
            />
          ))}
        </div>
      )}

      {isAdmin && (
        <LiveClassDialog
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setEditTarget(null); }}
          onSaved={onSaved}
          classrooms={classrooms}
          initial={editTarget}
        />
      )}
    </div>
  );
}

interface CardProps {
  event: CalendarEvent;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function LiveClassCard({ event, isAdmin, onEdit, onDelete }: CardProps) {
  const status = statusOf(event);
  const badge = statusBadge(status);
  const canJoin = status === 'live' || status === 'soon' || status === 'scheduled';

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.cls}`}>
              {badge.label}
            </span>
            <span className="inline-block rounded-full bg-white/60 border border-white/70 text-foreground/70 px-2 py-0.5 text-[10px] font-medium">
              {event.classroom?.name ?? 'Global'}
            </span>
          </div>
          <h3 className="font-semibold leading-tight">{event.title}</h3>
          <div className="text-xs text-muted-foreground mt-1">{formatWhen(event.startsAt, event.endsAt)}</div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={onEdit} title="Edit" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/60 hover:text-foreground">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={onDelete} title="Cancel" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-rose-500/15 hover:text-rose-700">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {event.description && (
        <p className="text-sm text-foreground/80 whitespace-pre-wrap line-clamp-3">{event.description}</p>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
        <span className="truncate">By {event.createdBy.name}</span>
        {canJoin && event.meetingUrl ? (
          <a
            href={event.meetingUrl}
            target="_blank"
            rel="noreferrer noopener"
            className={
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ' +
              (status === 'live' || status === 'soon'
                ? 'bg-brand text-white hover:bg-brand/90'
                : 'border border-white/70 bg-white/60 text-foreground hover:bg-white/90')
            }
          >
            <ExternalLink className="h-3.5 w-3.5" /> Join meeting
          </a>
        ) : null}
      </div>
    </Card>
  );
}
