import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import { Check, Copy, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AdminUser } from '@/lib/users';

interface Props {
  target: AdminUser | null;
  onClose: () => void;
  onReset: (password: string) => Promise<void>;
}

function randomPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  const arr = new Uint32Array(14);
  crypto.getRandomValues(arr);
  for (let i = 0; i < arr.length; i++) {
    out += alphabet[arr[i]! % alphabet.length];
  }
  return out;
}

export function ResetPasswordDialog({ target, onClose, onReset }: Props) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (target) {
      setPassword(randomPassword());
      setShown(null);
      setError(null);
      setCopied(false);
    }
  }, [target]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!target) return;
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onReset(password);
      setShown(password);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error ?? 'Could not reset password');
      } else {
        setError('Could not reset password');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function copyToClipboard() {
    if (!shown) return;
    try {
      await navigator.clipboard.writeText(shown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <Dialog
      open={!!target}
      onClose={onClose}
      title={shown ? 'Password reset' : 'Reset password'}
      description={
        target
          ? shown
            ? `Share this with ${target.name} — it will not be shown again.`
            : `Set a new password for ${target.name} (${target.email}).`
          : undefined
      }
    >
      {!shown ? (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <div className="flex gap-2">
              <Input
                id="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                spellCheck={false}
                required
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setPassword(randomPassword())}
                title="Generate new"
                className="px-3"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Minimum 8 characters. It will be shown once on this screen after reset.
            </p>
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Resetting…' : 'Reset password'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-white/70 border border-white/60 p-3 font-mono text-sm flex items-center justify-between gap-2">
            <span className="break-all">{shown}</span>
            <button
              type="button"
              onClick={copyToClipboard}
              className="inline-flex items-center gap-1 text-xs text-brand hover:underline shrink-0"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            For security this password will not be shown again. Make sure it has been copied or recorded before closing.
          </p>
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
