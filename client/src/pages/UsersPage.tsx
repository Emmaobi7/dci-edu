import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Plus, Search, ShieldCheck, Users as UsersIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import { listUsers, updateUserRole, type AdminUser } from '@/lib/users';
import type { Role } from '@/lib/types';
import { roleLabel } from '@/lib/utils';
import { UserCreateDialog } from '@/components/UserCreateDialog';

type RoleFilter = 'all' | Role;

const ROLE_FILTERS: { key: RoleFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'STUDENT', label: 'Students' },
  { key: 'TEACHER', label: 'Faculty' },
  { key: 'ADMIN', label: 'Admins' },
];

export function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  async function reload() {
    try {
      const rows = await listUsers();
      setUsers(rows);
      setError(null);
    } catch {
      setError('Could not load users');
    }
  }

  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    if (!users) return [];
    const needle = q.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!needle) return true;
      return (
        u.email.toLowerCase().includes(needle) ||
        u.name.toLowerCase().includes(needle)
      );
    });
  }, [users, q, roleFilter]);

  async function onChangeRole(target: AdminUser, role: Role) {
    if (target.role === role) return;
    if (target.id === me?.id) return;
    if (target.role === 'TEACHER' && role !== 'TEACHER' && target.ownedClassroomCount > 0) {
      const ok = window.confirm(
        `${target.name} owns ${target.ownedClassroomCount} class(es). Demote anyway? Existing classes will keep them as owner.`,
      );
      if (!ok) return;
    }
    setPendingId(target.id);
    try {
      const updated = await updateUserRole(target.id, role);
      setUsers((rows) => (rows ?? []).map((r) => (r.id === target.id ? updated : r)));
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error ?? 'Could not update role');
      } else {
        setError('Could not update role');
      }
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-brand/15 text-brand grid place-items-center">
            <UsersIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
            <p className="text-sm text-muted-foreground">
              Manage everyone in Wapcharm Classroom. Only admins can promote faculty or other admins.
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> New user
        </Button>
      </div>

      <Card className="p-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or email"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {ROLE_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setRoleFilter(f.key)}
                className={
                  'rounded-xl px-3 py-1.5 text-xs font-medium border transition-colors ' +
                  (roleFilter === f.key
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white/60 border-white/70 hover:bg-white/80')
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}

        {!users && !error && (
          <div className="text-sm text-muted-foreground">Loading…</div>
        )}

        {users && filtered.length === 0 && (
          <div className="text-sm text-muted-foreground">No users match.</div>
        )}

        {users && filtered.length > 0 && (
          <UsersTable
            rows={filtered}
            meId={me?.id ?? null}
            pendingId={pendingId}
            onChangeRole={onChangeRole}
          />
        )}
      </Card>

      <UserCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(u) => {
          setUsers((rows) => [u, ...(rows ?? [])]);
          setCreateOpen(false);
        }}
      />
    </div>
  );
}

interface TableProps {
  rows: AdminUser[];
  meId: string | null;
  pendingId: string | null;
  onChangeRole: (u: AdminUser, role: Role) => void;
}

function UsersTable({ rows, meId, pendingId, onChangeRole }: TableProps) {
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-2 py-2 font-medium">Name</th>
            <th className="px-2 py-2 font-medium">Email</th>
            <th className="px-2 py-2 font-medium">Role</th>
            <th className="px-2 py-2 font-medium">Classes</th>
            <th className="px-2 py-2 font-medium">Joined</th>
            <th className="px-2 py-2 font-medium text-right">Change role</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => {
            const isMe = u.id === meId;
            const isPending = pendingId === u.id;
            return (
              <tr key={u.id} className="border-t border-white/40">
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    {u.role === 'ADMIN' && <ShieldCheck className="h-3.5 w-3.5 text-brand" />}
                    <span className="font-medium">{u.name}</span>
                    {isMe && <span className="text-xs text-muted-foreground">(you)</span>}
                  </div>
                </td>
                <td className="px-2 py-2 text-muted-foreground">{u.email}</td>
                <td className="px-2 py-2">
                  <RolePill role={u.role} />
                </td>
                <td className="px-2 py-2 text-muted-foreground">
                  {u.role === 'STUDENT'
                    ? `${u.enrolmentCount} enrolled`
                    : `${u.ownedClassroomCount} owned`}
                </td>
                <td className="px-2 py-2 text-muted-foreground">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="px-2 py-2">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {(['STUDENT', 'TEACHER', 'ADMIN'] as Role[]).map((r) => (
                      <button
                        key={r}
                        disabled={isMe || isPending || u.role === r}
                        onClick={() => onChangeRole(u, r)}
                        className={
                          'rounded-lg px-2.5 py-1 text-xs font-medium border transition-colors ' +
                          (u.role === r
                            ? 'bg-brand text-white border-brand'
                            : 'bg-white/60 border-white/70 hover:bg-white/80 disabled:opacity-50 disabled:cursor-not-allowed')
                        }
                      >
                        {roleLabel(r)}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RolePill({ role }: { role: Role }) {
  const styles: Record<Role, string> = {
    ADMIN: 'bg-brand/15 text-brand',
    TEACHER: 'bg-violet-500/15 text-violet-700',
    STUDENT: 'bg-sky-500/15 text-sky-700',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[role]}`}>
      {roleLabel(role)}
    </span>
  );
}
