import { Link } from 'react-router-dom';
import { ArrowLeft, Check, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { QuizAttemptResult } from '@/lib/types';

interface Props {
  result: QuizAttemptResult;
  backTo?: string;
  backLabel?: string;
}

export function QuizResultView({ result, backTo, backLabel = 'Back to class' }: Props) {
  const score = result.score ?? 0;
  const pct = result.totalPoints > 0 ? Math.round((score / result.totalPoints) * 100) : 0;
  const correctCount = result.questions.filter((q) => q.correct).length;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">Your result</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Submitted {new Date(result.submittedAt).toLocaleString()}
            {result.isLate && <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/20 text-amber-800 px-2 py-0.5 text-xs font-medium">Late</span>}
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-3xl font-semibold text-brand">{score}<span className="text-base text-muted-foreground">/{result.totalPoints}</span></div>
            <div className="text-xs text-muted-foreground">{pct}% • {correctCount}/{result.questions.length} correct</div>
          </div>
        </div>
      </Card>

      <ul className="flex flex-col gap-3">
        {result.questions.map((q, i) => (
          <Card key={q.index} className={q.correct ? 'border-emerald-500/30' : 'border-destructive/30'}>
            <div className="flex items-start gap-3">
              <div className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${q.correct ? 'bg-emerald-500/15 text-emerald-700' : 'bg-destructive/15 text-destructive'}`}>
                {q.correct ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-medium">Q{i + 1}. {q.prompt}</h3>
                  <span className="text-xs text-muted-foreground">{q.points} pt{q.points === 1 ? '' : 's'}</span>
                </div>
                <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                  {q.options.map((opt) => {
                    const selected = q.selectedIndices.includes(opt.index);
                    const isCorrect = q.correctIndices?.includes(opt.index);
                    const tone =
                      isCorrect ? 'bg-emerald-500/10 border-emerald-500/40' :
                      selected && q.correctIndices ? 'bg-destructive/10 border-destructive/40' :
                      selected ? 'bg-foreground/5 border-foreground/15' :
                      'border-foreground/10';
                    return (
                      <li key={opt.index} className={`rounded-lg border px-3 py-2 flex items-center gap-2 ${tone}`}>
                        <span className="text-xs text-muted-foreground w-6">{selected ? '✓' : ''}</span>
                        <span className="flex-1">{opt.text}</span>
                        {isCorrect && <span className="text-xs text-emerald-700 font-medium">correct</span>}
                      </li>
                    );
                  })}
                </ul>
                {!result.showAnswers && (
                  <p className="mt-2 text-xs text-muted-foreground">Your faculty has hidden the correct answers.</p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </ul>

      {backTo && (
        <div>
          <Link to={backTo} className="text-sm text-brand hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> {backLabel}
          </Link>
        </div>
      )}
    </div>
  );
}
