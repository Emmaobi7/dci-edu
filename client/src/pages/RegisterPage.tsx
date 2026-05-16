import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

type SelectableRole = 'STUDENT' | 'TEACHER';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<SelectableRole>('STUDENT');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (role === 'STUDENT') {
        await register({ role, firstName, surname, email, password });
      } else {
        await register({ role, name, email, password });
      }
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error ?? 'Registration failed');
      } else {
        setError('Registration failed');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-brand text-white grid place-items-center font-bold shadow-glass-lg">W</div>
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-lg">Wapcharm Classroom</span>
              <span className="text-[11px] text-muted-foreground">West African Postgraduate College of Pharmacists</span>
            </div>
          </div>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>Join Wapcharm Classroom as a student or teacher.</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {role === 'STUDENT' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="surname">Surname</Label>
                <Input
                  id="surname"
                  required
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  autoComplete="family-name"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <span className="text-xs text-muted-foreground">At least 8 characters.</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>I am a</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['STUDENT', 'TEACHER'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    'rounded-xl px-3 py-2 text-sm font-medium border transition-all',
                    role === r
                      ? 'bg-brand text-white border-brand shadow-glass-lg'
                      : 'bg-white/60 border-white/70 hover:bg-white/80',
                  )}
                >
                  {r === 'STUDENT' ? 'Student' : 'Teacher'}
                </button>
              ))}
            </div>
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
          <Button type="submit" disabled={submitting} className="mt-2">
            {submitting ? 'Creating account…' : 'Create account'}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Already have an account?{' '}
            <Link to="/login" className="text-brand font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
