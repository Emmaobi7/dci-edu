import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch {
      // The server always returns 200; only network/validation issues land here.
      setError('Could not submit the request. Please check the email and try again.');
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
              src="/wapcp2-removebg-preview-Ci4PO0se.png"
              alt="WAPCPharm"
              className="h-10 w-10 rounded-xl object-cover shadow-glass-lg"
            />
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-lg">WAPCPharm Classroom</span>
              <span className="text-[11px] text-muted-foreground">West African Postgraduate College of Pharmacists</span>
            </div>
          </div>
          <CardTitle>Forgot your password?</CardTitle>
          <CardDescription>
            Enter your account email and we&apos;ll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        {sent ? (
          <div className="flex flex-col items-center text-center gap-3 mt-2">
            <div className="h-12 w-12 rounded-2xl bg-brand/15 text-brand grid place-items-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="font-semibold">Check your inbox</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              If an account exists for <span className="font-medium text-foreground">{email}</span>, a password reset link is on its way.
              The link expires in 30 minutes.
            </p>
            <p className="text-xs text-muted-foreground">
              Didn&apos;t get an email? Check your spam folder, or{' '}
              <button
                type="button"
                onClick={() => setSent(false)}
                className="text-brand font-medium hover:underline"
              >
                try a different email
              </button>
              .
            </p>
            <Button asChild variant="outline" className="mt-2">
              <Link to="/login">Back to sign in</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            {error && <div className="text-sm text-destructive">{error}</div>}
            <Button type="submit" disabled={submitting} className="mt-2">
              {submitting ? 'Sending…' : 'Send reset link'}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Remembered it?{' '}
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
