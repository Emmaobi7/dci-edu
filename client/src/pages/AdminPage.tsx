import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  FileSpreadsheet,
  GraduationCap,
  ListChecks,
  Notebook,
  School,
  Shield,
  ShieldCheck,
  UserMinus,
  UserPlus,
  Users as UsersIcon,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { getAdminStats, type AdminStats } from '@/lib/admin';

export function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch(() => setError('Could not load stats'));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-brand/15 text-brand grid place-items-center">
          <Shield className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
          <p className="text-sm text-muted-foreground">
            System-wide controls. Visible only to administrators.
          </p>
        </div>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {!stats && !error && (
        <div className="text-sm text-muted-foreground">Loading…</div>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={UsersIcon} label="Total users" value={stats.users.total} />
            <Stat icon={GraduationCap} label="Students" value={stats.users.students} />
            <Stat icon={Notebook} label="Faculty" value={stats.users.faculty} />
            <Stat icon={ShieldCheck} label="Admins" value={stats.users.admins} />
            <Stat icon={UserPlus} label="Signups (7d)" value={stats.users.signups7d} accent />
            <Stat icon={UserPlus} label="Signups (30d)" value={stats.users.signups30d} />
            <Stat icon={UserMinus} label="Suspended" value={stats.users.disabled} />
            <Stat icon={School} label="Classes" value={stats.classrooms} />
            <Stat icon={BookOpenCheck} label="Assignments" value={stats.assignments} />
            <Stat icon={ListChecks} label="Exams" value={stats.exams} />
            <Stat icon={CalendarDays} label="Events" value={stats.events} />
          </div>

          <Card className="p-4">
            <h2 className="text-sm font-semibold tracking-tight mb-3">Most active classes</h2>
            {stats.topClasses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No classes yet.</p>
            ) : (
              <ul className="divide-y divide-white/40">
                {stats.topClasses.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2">
                    <div>
                      <div className="font-medium text-sm">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.teacher?.name ?? '—'}
                      </div>
                    </div>
                    <span className="text-xs rounded-full bg-brand/10 text-brand px-2 py-0.5">
                      {c.studentCount} student{c.studentCount === 1 ? '' : 's'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AdminCard
          to="/users"
          icon={UsersIcon}
          title="User management"
          description="View accounts, change roles, reset passwords, suspend, import/export."
        />
        <AdminCard
          to="/admin/classes"
          icon={School}
          title="Class oversight"
          description="Browse every class with rosters, assignment and exam counts."
        />
        <AdminCard
          to="/admin/audit"
          icon={FileSpreadsheet}
          title="Audit log"
          description="Every admin action: role changes, password resets, suspensions, imports."
        />
      </div>
    </div>
  );
}

interface StatProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent?: boolean;
}

function Stat({ icon: Icon, label, value, accent }: StatProps) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div
        className={
          'h-10 w-10 rounded-xl grid place-items-center shrink-0 ' +
          (accent ? 'bg-brand text-white' : 'bg-brand/10 text-brand')
        }
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground truncate">{label}</div>
        <div className="text-xl font-semibold tracking-tight">{value}</div>
      </div>
    </Card>
  );
}

interface AdminCardProps {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

function AdminCard({ to, icon: Icon, title, description }: AdminCardProps) {
  return (
    <Link to={to} className="block">
      <Card className="p-5 flex items-start gap-4 hover:bg-white/70 transition-colors h-full">
        <div className="h-11 w-11 rounded-xl bg-brand/15 text-brand grid place-items-center shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">{title}</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
      </Card>
    </Link>
  );
}
