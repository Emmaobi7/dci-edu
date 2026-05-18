import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { InsightStudentRow } from '@/lib/types';

type SortKey = 'name' | 'assignments' | 'avgGrade' | 'quizzes' | 'avgQuiz' | 'missing';

export function StudentsTable({ students }: { students: InsightStudentRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [dir, setDir] = useState<1 | -1>(1);

  const rows = useMemo(() => {
    const arr = [...students];
    arr.sort((a, b) => {
      const v = compareBy(a, b, sortKey);
      return v * dir;
    });
    return arr;
  }, [students, sortKey, dir]);

  function toggle(key: SortKey) {
    if (sortKey === key) setDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(key); setDir(1); }
  }

  if (students.length === 0) {
    return (
      <Card className="text-center py-8 text-sm text-muted-foreground">
        No students enrolled yet.
      </Card>
    );
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h3 className="font-semibold">Per-student breakdown</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/40 border-y border-foreground/10 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <Th onClick={() => toggle('name')} active={sortKey === 'name'} dir={dir}>Student</Th>
              <Th onClick={() => toggle('assignments')} active={sortKey === 'assignments'} dir={dir}>Assignments</Th>
              <Th onClick={() => toggle('avgGrade')} active={sortKey === 'avgGrade'} dir={dir}>Avg grade</Th>
              <Th onClick={() => toggle('quizzes')} active={sortKey === 'quizzes'} dir={dir}>Exams</Th>
              <Th onClick={() => toggle('avgQuiz')} active={sortKey === 'avgQuiz'} dir={dir}>Avg exam %</Th>
              <Th onClick={() => toggle('missing')} active={sortKey === 'missing'} dir={dir}>Missing</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/10">
            {rows.map((s) => (
              <tr key={s.id} className="hover:bg-white/40">
                <td className="px-4 py-3">
                  <div className="font-medium truncate max-w-[12rem]">{s.name}</div>
                  <div className="text-xs text-muted-foreground truncate max-w-[12rem]">{s.email}</div>
                </td>
                <td className="px-4 py-3">
                  <ProgressCell submitted={s.assignmentsSubmitted} total={s.assignmentsTotal} />
                </td>
                <td className="px-4 py-3">
                  {s.gradedCount > 0
                    ? <span className="font-medium">{s.avgGrade}%</span>
                    : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3">
                  <ProgressCell submitted={s.quizzesSubmitted} total={s.quizzesTotal} />
                </td>
                <td className="px-4 py-3">
                  {s.quizzesSubmitted > 0
                    ? <span className="font-medium">{s.avgQuizPercent}%</span>
                    : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3">
                  {s.missingCount > 0
                    ? <span className="inline-flex items-center rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-xs font-medium">{s.missingCount}</span>
                    : <span className="text-muted-foreground">0</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Th({
  children, onClick, active, dir,
}: { children: React.ReactNode; onClick: () => void; active: boolean; dir: 1 | -1 }) {
  return (
    <th className="text-left font-medium px-4 py-2">
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
        {children}
        {active
          ? (dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
          : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </button>
    </th>
  );
}

function ProgressCell({ submitted, total }: { submitted: number; total: number }) {
  const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[8rem]">
      <div className="flex-1 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
        <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs tabular-nums text-muted-foreground shrink-0">{submitted}/{total}</div>
    </div>
  );
}

function compareBy(a: InsightStudentRow, b: InsightStudentRow, key: SortKey): number {
  switch (key) {
    case 'name': return a.name.localeCompare(b.name);
    case 'assignments': return ratio(a.assignmentsSubmitted, a.assignmentsTotal) - ratio(b.assignmentsSubmitted, b.assignmentsTotal);
    case 'avgGrade': return a.avgGrade - b.avgGrade;
    case 'quizzes': return ratio(a.quizzesSubmitted, a.quizzesTotal) - ratio(b.quizzesSubmitted, b.quizzesTotal);
    case 'avgQuiz': return a.avgQuizPercent - b.avgQuizPercent;
    case 'missing': return a.missingCount - b.missingCount;
  }
}

function ratio(n: number, d: number): number {
  return d > 0 ? n / d : 0;
}
