import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Search, School } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { listAdminClassrooms, type AdminClassroom } from '@/lib/admin';
import { API_BASE_URL } from '@/lib/api';

export function AdminClassesPage() {
  const [rows, setRows] = useState<AdminClassroom[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    listAdminClassrooms()
      .then(setRows)
      .catch(() => setError('Could not load classes'));
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(needle) ||
        r.code.toLowerCase().includes(needle) ||
        r.teacher.name.toLowerCase().includes(needle) ||
        r.teacher.email.toLowerCase().includes(needle),
    );
  }, [rows, q]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-brand/15 text-brand grid place-items-center">
            <School className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Class oversight</h1>
            <p className="text-sm text-muted-foreground">
              Every class on the platform with rosters and activity counts.
            </p>
          </div>
        </div>
        <a
          href={`${API_BASE_URL}/admin/classrooms/export.csv`}
          className="inline-flex items-center gap-2 rounded-xl border border-white/70 bg-white/60 px-3 py-2 text-sm font-medium hover:bg-white/80 transition-colors"
        >
          <Download className="h-4 w-4" /> Export CSV
        </a>
      </div>

      <Card className="p-4 flex flex-col gap-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, code, or teacher"
            className="pl-9"
          />
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}
        {!rows && !error && <div className="text-sm text-muted-foreground">Loading…</div>}
        {rows && filtered.length === 0 && (
          <div className="text-sm text-muted-foreground">No classes match.</div>
        )}

        {rows && filtered.length > 0 && (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 font-medium">Class</th>
                  <th className="px-2 py-2 font-medium">Code</th>
                  <th className="px-2 py-2 font-medium">Faculty</th>
                  <th className="px-2 py-2 font-medium text-right">Students</th>
                  <th className="px-2 py-2 font-medium text-right">Assign.</th>
                  <th className="px-2 py-2 font-medium text-right">Exams</th>
                  <th className="px-2 py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-t border-white/40">
                    <td className="px-2 py-2">
                      <Link to={`/classes/${c.id}`} className="font-medium hover:text-brand">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-2 py-2 font-mono text-xs text-muted-foreground">{c.code}</td>
                    <td className="px-2 py-2">
                      <div className="text-sm">{c.teacher.name}</div>
                      <div className="text-xs text-muted-foreground">{c.teacher.email}</div>
                    </td>
                    <td className="px-2 py-2 text-right">{c._count.enrolments}</td>
                    <td className="px-2 py-2 text-right">{c._count.assignments}</td>
                    <td className="px-2 py-2 text-right">{c._count.quizzes}</td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
