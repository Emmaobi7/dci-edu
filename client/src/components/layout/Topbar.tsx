import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, UserCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { resolveApiUrl } from '@/lib/api';
import { cn, roleLabel } from '@/lib/utils';
import { NotificationBell } from '@/components/NotificationBell';

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const canEditProfile = user?.role === 'STUDENT' || user?.role === 'TEACHER';
  const avatar = resolveApiUrl(user?.avatarUrl ?? null);
  const initial = (user?.name || user?.email || '?').slice(0, 1).toUpperCase();

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <header className="glass-strong sticky top-0 z-20 flex h-16 items-center justify-between rounded-2xl px-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="text-sm text-muted-foreground hidden sm:block">Welcome back</div>
        <div className="font-semibold truncate max-w-[40vw]">{user?.name}</div>
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <div ref={wrapRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={open}
            className={cn(
              'flex items-center gap-2 rounded-full pl-1 pr-2 py-1 text-sm font-medium transition-colors',
              'hover:bg-white/60 hover:backdrop-blur-md',
              open && 'bg-white/60 backdrop-blur-md',
            )}
          >
            {avatar ? (
              <img src={avatar} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-white/70" />
            ) : (
              <span className="h-8 w-8 rounded-full bg-brand/15 text-brand grid place-items-center text-sm">
                {initial}
              </span>
            )}
            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
          </button>

          {open && (
            <div
              role="menu"
              className="glass-strong absolute right-0 mt-2 w-64 rounded-2xl p-2 shadow-glass-lg z-30"
            >
              <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                {avatar ? (
                  <img src={avatar} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-white/70" />
                ) : (
                  <span className="h-10 w-10 rounded-full bg-brand/15 text-brand grid place-items-center text-base font-semibold">
                    {initial}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{user?.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
                  <span className="mt-1 inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand-700">
                    {roleLabel(user?.role)}
                  </span>
                </div>
              </div>
              <div className="my-1 h-px bg-foreground/10" />
              {canEditProfile && (
                <Link
                  to="/profile"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium hover:bg-white/60 hover:backdrop-blur-md transition-colors"
                >
                  <UserCircle2 className="h-4 w-4" /> Profile
                </Link>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => { setOpen(false); void logout(); }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-destructive hover:bg-white/60 hover:backdrop-blur-md transition-colors"
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
