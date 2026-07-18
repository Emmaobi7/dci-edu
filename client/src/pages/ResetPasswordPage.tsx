import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => searchParams.get('token') ?? '', [searchParams]);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error ?? 'Could not reset password.');
      } else {
        setError('Could not reset password.');
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
            <img
              src="/dci-logo.png"
              alt="DCIAFRICA"
              className="h-10 w-10 rounded-xl object-contain shadow-glass-lg"
            />
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-lg bg-gradient-to-r from-[#fbbf24] to-[#00b9ae] bg-clip-text text-transparent">DCIAFRICA</span>
              <span className="text-[11px] text-muted-foreground">Digital Connect Institute Africa</span>
            </div>
          </div>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>
            Pick a strong password you haven&apos;t used before. Minimum 8 characters.
          </CardDescription>
        </CardHeader>

        {!token ? (
          <div className="flex flex-col gap-3 mt-2">
            <p className="text-sm text-destructive">
              This page is missing the reset token. Please use the link from your email.
            </p>
            <Button asChild variant="outline">
              <Link to="/forgot-password">Request a new link</Link>
            </Button>
          </div>
        ) : done ? (
          <div className="flex flex-col items-center text-center gap-3 mt-2">
            <div className="h-12 w-12 rounded-2xl bg-brand/15 text-brand grid place-items-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="font-semibold">Password updated</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              You can now sign in with your new password. Redirecting to sign in…
            </p>
            <Button asChild className="mt-2">
              <Link to="/login">Sign in now</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">New password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {error && <div className="text-sm text-destructive">{error}</div>}
            <Button type="submit" disabled={submitting} className="mt-2">
              {submitting ? 'Saving…' : 'Reset password'}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              <Link to="/login" className="text-brand font-medium hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}
