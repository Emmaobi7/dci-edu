import { Link, useParams } from 'react-router-dom';
import type { QuizAttemptRow } from '@/lib/types';

interface Props {
  attempts: QuizAttemptRow[] | null;
  classId: string;
}

export function TeacherAttemptsList({ attempts, classId }: Props) {
  const { id: quizId = '' } = useParams<{ id: string }>();

  if (attempts === null) {
    return <div className="text-sm text-muted-foreground">Loading attempts…</div>;
  }
  if (attempts.length === 0) {
    return <div className="text-sm text-muted-foreground py-4 text-center">No attempts yet.</div>;
  }

  return (
    <ul className="divide-y divide-foreground/10">
      {attempts.map((a) => {
        const submitted = !!a.submittedAt;
        const pct = a.totalPoints > 0 && a.score !== null
          ? Math.round((a.score / a.totalPoints) * 100)
          : null;
        return (
          <li key={a.id} className="py-3">
            <Link
              to={`/classes/${classId}/quizzes/${quizId}/attempts/${a.id}`}
              className="flex items-center justify-between gap-3 group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-full bg-brand/15 text-brand grid place-items-center font-medium shrink-0">
                  {a.student.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate group-hover:text-brand">{a.student.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {submitted
                      ? <>Submitted {new Date(a.submittedAt!).toLocaleString()}</>
                      : <>Started {new Date(a.startedAt).toLocaleString()} — in progress</>}
                    {a.isLate && <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/20 text-amber-800 px-2 py-0.5 text-[10px] font-medium">Late</span>}
                  </div>
                </div>
              </div>
              <div className="text-right text-sm shrink-0">
                {submitted && a.score !== null ? (
                  <>
                    <div className="font-semibold">{a.score}/{a.totalPoints}</div>
                    {pct !== null && <div className="text-xs text-muted-foreground">{pct}%</div>}
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
