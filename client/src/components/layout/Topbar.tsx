import { Link } from 'react-router-dom';
import { LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { resolveApiUrl } from '@/lib/api';
import { NotificationBell } from '@/components/NotificationBell';

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const canEditProfile = user?.role === 'STUDENT' || user?.role === 'TEACHER';
  const avatar = resolveApiUrl(user?.avatarUrl ?? null);
  const initial = (user?.name || user?.email || '?').slice(0, 1).toUpperCase();
  return (
    <header className="glass-strong sticky top-0 z-20 flex h-16 items-center justify-between rounded-2xl px-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="text-sm text-muted-foreground hidden sm:block">Welcome back</div>
        {canEditProfile ? (
          <Link to="/profile" className="group flex items-center gap-2 font-semibold hover:text-brand transition-colors">
            {avatar ? (
              <img src={avatar} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-white/70" />
            ) : (
              <span className="h-8 w-8 rounded-full bg-brand/15 text-brand grid place-items-center text-sm">
                {initial}
              </span>
            )}
            <span>{user?.name}</span>
          </Link>
        ) : (
          <div className="font-semibold">{user?.name}</div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline-flex items-center rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand-700">
          {user?.role}
        </span>
        <NotificationBell />
        <Button variant="outline" size="sm" onClick={() => void logout()}>
          <LogOut className="h-4 w-4" /> Logout
        </Button>
      </div>
    </header>
  );
}
