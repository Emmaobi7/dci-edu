import { NavLink } from 'react-router-dom';
import { BookOpen, GraduationCap, LayoutDashboard, Users, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import type { Role } from '@/lib/types';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: Role[];
}

const items: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/classes', label: 'Classes', icon: BookOpen },
  { to: '/students', label: 'Students', icon: GraduationCap, roles: ['TEACHER', 'ADMIN'] },
  { to: '/users', label: 'Users', icon: Users, roles: ['ADMIN'] },
  { to: '/admin', label: 'Admin', icon: Shield, roles: ['ADMIN'] },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const visible = items.filter((i) => !i.roles || (user && i.roles.includes(user.role)));

  return (
    <aside className="glass-strong h-full w-64 shrink-0 rounded-2xl p-4 flex flex-col gap-2">
      <div className="px-2 py-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-brand text-white grid place-items-center font-bold shadow-glass-lg">W</div>
          <div>
            <div className="font-semibold leading-tight">Wapcharm</div>
            <div className="text-xs text-muted-foreground">Classroom</div>
          </div>
        </div>
      </div>
      <nav className="flex flex-col gap-1 mt-2">
        {visible.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand text-white shadow-glass-lg'
                  : 'text-foreground/80 hover:bg-white/60 hover:backdrop-blur-md',
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto px-2 py-3 text-xs text-muted-foreground">
        {user && (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-foreground/80">{user.name}</span>
            <span>{user.role.toLowerCase()}</span>
          </div>
        )}
      </div>
    </aside>
  );
}
