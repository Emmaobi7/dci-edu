import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  BarChart3, ClipboardCheck, FileQuestion, GraduationCap, Users,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { getClassroomInsights } from '@/lib/insights';
import type { ClassroomInsights } from '@/lib/types';
import { StudentsTable } from '@/components/InsightsStudentsTable';

const BRAND = '#C66726';
const BRAND_LIGHT = '#E2853B';

export function InsightsTab({ classroomId }: { classroomId: string }) {
  const [data, setData] = useState<ClassroomInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getClassroomInsights(classroomId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => { if (!cancelled) setError(extractError(err) ?? 'Failed to load insights'); });
    return () => { cancelled = true; };
  }, [classroomId]);

  const assignmentChart = useMemo(
    () => (data?.assignments ?? []).map((a) => ({ name: truncate(a.title, 16), value: a.completionRate })),
    [data],
  );
  const quizChart = useMemo(
    () => (data?.quizzes ?? []).map((q) => ({ name: truncate(q.title, 16), value: q.avgPercent })),
    [data],
  );

  if (error) return <div className="text-sm text-destructive">{error}</div>;
  if (!data) return <div className="text-sm text-muted-foreground">Loading insights…</div>;

  const { totals, assignments, quizzes, students } = data;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5" />} label="Students" value={totals.studentCount} />
        <StatCard icon={<ClipboardCheck className="h-5 w-5" />} label="Avg completion" value={`${totals.avgCompletionRate}%`} hint={`${totals.assignmentsTotal} assignments`} />
        <StatCard icon={<FileQuestion className="h-5 w-5" />} label="Avg exam score" value={`${totals.avgQuizPercent}%`} hint={`${totals.quizzesTotal} exams`} />
        <StatCard icon={<GraduationCap className="h-5 w-5" />} label="Submitted total" value={assignments.reduce((a, x) => a + x.submitted, 0) + quizzes.reduce((a, x) => a + x.submitted, 0)} hint="assignments + exams" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-brand" />
            <h3 className="font-semibold">Assignment completion %</h3>
          </div>
          {assignmentChart.length === 0 ? (
            <EmptyChart label="No assignments yet" />
          ) : (
            <ChartFrame>
              <BarChart data={assignmentChart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip cursor={{ fill: 'rgba(198,103,38,0.08)' }} formatter={(v) => [`${Number(v ?? 0)}%`, 'Completion']} />
                <Bar dataKey="value" fill={BRAND} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartFrame>
          )}
        </Card>
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-brand" />
            <h3 className="font-semibold">Avg exam score %</h3>
          </div>
          {quizChart.length === 0 ? (
            <EmptyChart label="No exams yet" />
          ) : (
            <ChartFrame>
              <BarChart data={quizChart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip cursor={{ fill: 'rgba(198,103,38,0.08)' }} formatter={(v) => [`${Number(v ?? 0)}%`, 'Avg score']} />
                <Bar dataKey="value" fill={BRAND_LIGHT} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartFrame>
          )}
        </Card>
      </div>

      <StudentsTable students={students} />
    </div>
  );
}

function StatCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold text-brand mt-0.5">{value}</div>
          {hint && <div className="text-xs text-muted-foreground mt-0.5 truncate">{hint}</div>}
        </div>
        <div className="h-9 w-9 rounded-xl bg-brand/15 text-brand grid place-items-center shrink-0">{icon}</div>
      </div>
    </Card>
  );
}

function ChartFrame({ children }: { children: React.ReactElement }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return <div className="h-64 grid place-items-center text-sm text-muted-foreground">{label}</div>;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function extractError(err: unknown): string | null {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; message?: string } | undefined;
    return data?.error ?? data?.message ?? err.message;
  }
  return null;
}
