import { LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { NotificationBell } from '@/components/NotificationBell';

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  return (
    <header className="glass-strong sticky top-0 z-20 flex h-16 items-center justify-between rounded-2xl px-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="text-sm text-muted-foreground hidden sm:block">Welcome back</div>
        <div className="font-semibold">{user?.name}</div>
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
