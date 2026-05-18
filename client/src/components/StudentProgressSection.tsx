import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { BarChart3, BookOpen } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { getMyInsights } from '@/lib/insights';
import type { MyInsightClass, MyInsights } from '@/lib/types';

const BRAND = '#C66726';

export function StudentProgressSection() {
  const [data, setData] = useState<MyInsights | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyInsights()
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { /* non-fatal */ });
    return () => { cancelled = true; };
  }, []);

  const chartData = useMemo(
    () => (data?.classes ?? [])
      .filter((c) => c.gradedCount > 0 || c.quizzesSubmitted > 0)
      .map((c) => ({
        name: truncate(c.name, 14),
        grade: c.gradedCount > 0 ? c.avgGrade : 0,
        quiz: c.quizzesSubmitted > 0 ? c.avgQuizPercent : 0,
      })),
    [data],
  );

  if (!data || data.classes.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Your progress</h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.classes.map((c) => <ProgressCard key={c.classroomId} c={c} />)}
      </div>

      {chartData.length >= 2 && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-brand" />
            <h3 className="font-semibold">Avg grade & exam score by class</h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip cursor={{ fill: 'rgba(198,103,38,0.08)' }} formatter={(v, k) => [`${Number(v ?? 0)}%`, k === 'grade' ? 'Avg grade' : 'Avg exam']} />
                <Bar dataKey="grade" fill={BRAND} radius={[6, 6, 0, 0]} name="Avg grade" />
                <Bar dataKey="quiz" fill="#E2853B" radius={[6, 6, 0, 0]} name="Avg exam" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}

function ProgressCard({ c }: { c: MyInsightClass }) {
  const aPct = c.assignmentsTotal > 0 ? Math.round((c.assignmentsSubmitted / c.assignmentsTotal) * 100) : 0;
  const qPct = c.quizzesTotal > 0 ? Math.round((c.quizzesSubmitted / c.quizzesTotal) * 100) : 0;
  return (
    <Link to={`/classes/${c.classroomId}`} className="group">
      <Card className="h-full transition-transform group-hover:-translate-y-0.5 group-hover:shadow-glass-lg">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand/15 text-brand grid place-items-center shrink-0">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate">{c.name}</div>
            <div className="text-xs text-muted-foreground truncate">{c.teacherName}</div>
          </div>
          {c.overdueCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-xs font-medium shrink-0">
              {c.overdueCount} overdue
            </span>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <Progress label="Assignments" submitted={c.assignmentsSubmitted} total={c.assignmentsTotal} pct={aPct} />
          <Progress label="Exams" submitted={c.quizzesSubmitted} total={c.quizzesTotal} pct={qPct} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          {c.gradedCount > 0 ? (
            <span className="inline-flex items-center rounded-full bg-brand/10 text-brand px-2 py-0.5 font-medium">
              Avg grade {c.avgGrade}%
            </span>
          ) : (
            <span className="text-muted-foreground">No grades yet</span>
          )}
          {c.quizzesSubmitted > 0 && (
            <span className="inline-flex items-center rounded-full bg-foreground/5 text-foreground/80 px-2 py-0.5 font-medium">
              Exam {c.avgQuizPercent}%
            </span>
          )}
          {c.pendingCount > 0 && (
            <span className="text-muted-foreground">{c.pendingCount} pending</span>
          )}
        </div>
      </Card>
    </Link>
  );
}

function Progress({ label, submitted, total, pct }: { label: string; submitted: number; total: number; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums text-foreground/80">{submitted}/{total}{total > 0 ? ` · ${pct}%` : ''}</span>
      </div>
      <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
        <div className="h-full bg-brand transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
