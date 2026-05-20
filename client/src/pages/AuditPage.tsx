import { useEffect, useMemo, useState } from 'react';
import {
  FileSpreadsheet,
  KeyRound,
  Pause,
  Play,
  Trash2,
  Upload,
  UserCog,
  UserPlus,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { listAuditEvents, type AuditAction, type AuditEvent } from '@/lib/admin';

const ACTION_META: Record<AuditAction, { label: string; short: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  USER_CREATED:        { label: 'User created',     short: 'Created',     icon: UserPlus,  tone: 'bg-emerald-500/15 text-emerald-700' },
  USER_ROLE_CHANGED:   { label: 'Role changed',     short: 'Role',        icon: UserCog,   tone: 'bg-violet-500/15 text-violet-700' },
  USER_PASSWORD_RESET: { label: 'Password reset',   short: 'Password',    icon: KeyRound,  tone: 'bg-sky-500/15 text-sky-700' },
  USER_DISABLED:       { label: 'User suspended',   short: 'Suspended',   icon: Pause,     tone: 'bg-amber-500/15 text-amber-700' },
  USER_ENABLED:        { label: 'User reactivated', short: 'Reactivated', icon: Play,      tone: 'bg-emerald-500/15 text-emerald-700' },
  USER_IMPORTED:       { label: 'CSV import',       short: 'Import',      icon: Upload,    tone: 'bg-sky-500/15 text-sky-700' },
  CLASSROOM_DELETED:   { label: 'Class deleted',    short: 'Class',       icon: Trash2,    tone: 'bg-rose-500/15 text-rose-700' },
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [actionFilter, setActionFilter] = useState<AuditAction | 'all'>('all');

  useEffect(() => {
    listAuditEvents(300)
      .then(setEvents)
      .catch(() => setError('Could not load audit log'));
  }, []);

  const filtered = useMemo(() => {
    if (!events) return [];
    const needle = q.trim().toLowerCase();
    return events.filter((e) => {
      if (actionFilter !== 'all' && e.action !== actionFilter) return false;
      if (!needle) return true;
      return (
        e.summary.toLowerCase().includes(needle) ||
        e.actor?.email.toLowerCase().includes(needle) ||
        e.actor?.name.toLowerCase().includes(needle) ||
        e.targetUser?.email.toLowerCase().includes(needle) ||
        false
      );
    });
  }, [events, q, actionFilter]);

  const actions = Object.keys(ACTION_META) as AuditAction[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-brand/15 text-brand grid place-items-center">
          <FileSpreadsheet className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
          <p className="text-sm text-muted-foreground">
            Every sensitive admin action recorded automatically.
          </p>
        </div>
      </div>

      <Card className="p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search summary, actor, or target"
          />
          <div className="-mx-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex items-center gap-1.5 px-1">
              <FilterPill active={actionFilter === 'all'} onClick={() => setActionFilter('all')}>
                All
              </FilterPill>
              {actions.map((a) => (
                <FilterPill key={a} active={actionFilter === a} onClick={() => setActionFilter(a)}>
                  {ACTION_META[a].short}
                </FilterPill>
              ))}
            </div>
          </div>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}
        {!events && !error && <div className="text-sm text-muted-foreground">Loading…</div>}
        {events && filtered.length === 0 && (
          <div className="text-sm text-muted-foreground py-6 text-center">No events match.</div>
        )}

        {events && filtered.length > 0 && (
          <ul className="divide-y divide-white/40 -mx-1">
            {filtered.map((e) => {
              const meta = ACTION_META[e.action];
              const Icon = meta.icon;
              return (
                <li key={e.id} className="flex items-center gap-3 px-1 py-3">
                  <div className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 ${meta.tone}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{e.summary}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      by {e.actor?.name ?? 'system'}
                      {e.actor && <span className="opacity-70"> · {e.actor.email}</span>}
                    </div>
                  </div>
                  <div
                    className="text-xs text-muted-foreground shrink-0 tabular-nums whitespace-nowrap"
                    title={new Date(e.createdAt).toLocaleString()}
                  >
                    {formatTime(e.createdAt)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        'rounded-xl px-3 py-1.5 text-xs font-medium border transition-colors ' +
        (active
          ? 'bg-brand text-white border-brand'
          : 'bg-white/60 border-white/70 hover:bg-white/80')
      }
    >
      {children}
    </button>
  );
}
