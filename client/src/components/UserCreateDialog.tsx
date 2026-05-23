import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminCreateUser, type AdminUser } from '@/lib/users';
import type { Role } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (user: AdminUser) => void;
}

const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: 'STUDENT', label: 'Student', hint: 'Can join classes with a code.' },
  { value: 'TEACHER', label: 'Faculty', hint: 'Can create and own classes.' },
  { value: 'ADMIN', label: 'Admin', hint: 'Full access including user management.' },
];

export function UserCreateDialog({ open, onClose, onCreated }: Props) {
  const [role, setRole] = useState<Role>('TEACHER');
  const [name, setName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setRole('TEACHER');
    setName('');
    setFirstName('');
    setSurname('');
    setEmail('');
    setPassword('');
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user =
        role === 'STUDENT'
          ? await adminCreateUser({ role, email, password, firstName, surname })
          : await adminCreateUser({ role, email, password, name });
      onCreated(user);
      reset();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error ?? 'Could not create user');
      } else {
        setError('Could not create user');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Create user"
      description="Provision a new account for any role. The user can sign in immediately with the password below."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4 mt-2">
        <div className="flex flex-col gap-1.5">
          <Label>Role</Label>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                className={
                  'rounded-xl px-3 py-2 text-sm font-medium border transition-all text-center ' +
                  (role === r.value
                    ? 'bg-brand text-white border-brand shadow-glass-lg'
                    : 'bg-white/60 border-white/70 hover:bg-white/80')
                }
              >
                {r.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {ROLES.find((r) => r.value === role)?.hint}
          </span>
        </div>

        {role === 'STUDENT' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="surname">Surname</Label>
              <Input id="surname" required value={surname} onChange={(e) => setSurname(e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="newEmail">Email</Label>
          <Input id="newEmail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="newPassword">Password</Label>
          <div className="relative">
            <Input
              id="newPassword"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
          <span className="text-xs text-muted-foreground">
            At least 8 characters. Share this with the user securely.
          </span>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}

        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="ghost" onClick={() => { reset(); onClose(); }}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create user'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
