import { NavLink } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileSpreadsheet,
  GraduationCap,
  LayoutDashboard,
  LifeBuoy,
  Library,
  School,
  Shield,
  Users,
  Video,
} from 'lucide-react';
import { cn, roleLabel } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import type { Role } from '@/lib/types';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: Role[];
  hideForRoles?: Role[];
  end?: boolean;
}

const items: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/classes', label: 'Classes', icon: BookOpen, hideForRoles: ['ADMIN'] },
  { to: '/live-classes', label: 'Live Classes', icon: Video },
  { to: '/notifications', label: 'Notifications', icon: Bell, hideForRoles: ['ADMIN'] },
  { to: '/assessment', label: 'Assessment', icon: ClipboardList, hideForRoles: ['ADMIN'] },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/resources', label: 'Resources', icon: Library },
  { to: '/help', label: 'Help / Guard', icon: LifeBuoy },
  { to: '/students', label: 'Students', icon: GraduationCap, roles: ['TEACHER'] },
  { to: '/users', label: 'Users', icon: Users, roles: ['ADMIN'] },
  { to: '/admin/classes', label: 'All classes', icon: School, roles: ['ADMIN'] },
  { to: '/admin/audit', label: 'Audit log', icon: FileSpreadsheet, roles: ['ADMIN'] },
  { to: '/admin', label: 'Admin', icon: Shield, roles: ['ADMIN'], end: true },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const visible = items.filter((i) => {
    if (i.roles && (!user || !i.roles.includes(user.role))) return false;
    if (i.hideForRoles && user && i.hideForRoles.includes(user.role)) return false;
    return true;
  });

  return (
    <aside className="glass-strong h-full w-64 shrink-0 rounded-2xl p-4 flex flex-col gap-2">
      <div className="px-2 py-3">
        <div className="flex items-center gap-2">
          <img
            src="/wapcp2-removebg-preview-Ci4PO0se.png"
            alt="WAPCPharm"
            className="h-9 w-9 rounded-xl object-cover shadow-glass-lg"
          />
          <div>
            <div className="font-semibold leading-tight">WAPCPharm</div>
            <div className="text-xs text-muted-foreground">Classroom</div>
          </div>
        </div>
      </div>
      <nav className="flex flex-col gap-1 mt-2">
        {visible.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
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
            <span>{roleLabel(user.role)}</span>
          </div>
        )}
      </div>
    </aside>
  );
}
