import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, ClipboardList, GraduationCap, Library, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const FEATURES = [
  {
    icon: BookOpen,
    title: 'Classes',
    body: 'Join classes with a short code and stay on top of announcements, members, and discussions in one place.',
  },
  {
    icon: ClipboardList,
    title: 'Assignments & Exams',
    body: 'Submit assignments, sit exams, and track grades on a single Assessment page filtered by status.',
  },
  {
    icon: Video,
    title: 'Live Classes',
    body: 'See live and upcoming sessions and join with one click — straight from your dashboard or calendar.',
  },
  {
    icon: Library,
    title: 'Resources',
    body: 'Access reading materials, links, and recordings shared by faculty across every class you belong to.',
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-4 sm:px-8 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img
            src="/dci-logo.png"
            alt="DCIAFRICA"
            className="h-10 w-10 rounded-xl object-contain"
          />
          <div className="flex flex-col leading-tight">
            <span className="font-bold bg-gradient-to-r from-[#fbbf24] to-[#00b9ae] bg-clip-text text-transparent">DCIAFRICA</span>
            <span className="text-[11px] text-muted-foreground">Digital Connect Institute Africa</span>
          </div>
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link to="/register">Get started</Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1 px-4 sm:px-8 pb-12">
        <section className="max-w-5xl mx-auto pt-10 sm:pt-16 text-center">
          <div className="mx-auto mb-6 h-20 w-20 rounded-3xl bg-brand/15 grid place-items-center shadow-glass-lg">
            <img
              src="/dci-logo.png"
              alt="DCIAFRICA"
              className="h-14 w-14 object-contain"
            />
          </div>
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-balance">
            The learning platform powering Africa's digital campus future.
          </h1>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            DCIAFRICA Classroom brings classes, live sessions, assessments, and resources together so faculty
            can teach and students can learn — all in one place.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/register">
                Create student account <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">I already have an account</Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Faculty and administrator accounts are provisioned by an administrator.
          </p>
        </section>

        <section className="max-w-5xl mx-auto mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="p-5">
              <div className="h-10 w-10 rounded-xl bg-brand/15 text-brand grid place-items-center mb-3">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </Card>
          ))}
        </section>

        <section className="max-w-5xl mx-auto mt-16 grid gap-4 sm:grid-cols-2">
          <Card className="p-6">
            <div className="h-10 w-10 rounded-xl bg-brand/15 text-brand grid place-items-center mb-3">
              <GraduationCap className="h-5 w-5" />
            </div>
            <h3 className="font-semibold">For students</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign up, join your class with the code from your faculty, and you're set. Submissions, grades,
              announcements, and live sessions all in one feed.
            </p>
            <Button asChild className="mt-4" variant="outline">
              <Link to="/register">Create your account</Link>
            </Button>
          </Card>
          <Card className="p-6">
            <div className="h-10 w-10 rounded-xl bg-brand/15 text-brand grid place-items-center mb-3">
              <BookOpen className="h-5 w-5" />
            </div>
            <h3 className="font-semibold">For faculty</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Run your classes end-to-end: post announcements, schedule live sessions, set assignments and exams,
              grade with feedback, and track student progress.
            </p>
            <Button asChild className="mt-4" variant="outline">
              <Link to="/login">Sign in to teach</Link>
            </Button>
          </Card>
        </section>
      </main>

      <footer className="px-4 sm:px-8 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Digital Connect Institute Africa. DCIAFRICA Classroom.
      </footer>
    </div>
  );
}
