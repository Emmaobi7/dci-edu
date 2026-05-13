import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen p-3 sm:p-4 lg:p-5">
      <div className="flex gap-4">
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        {/* Mobile drawer */}
        <div
          className={cn(
            'fixed inset-0 z-30 lg:hidden transition-opacity',
            open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
          )}
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div
            className={cn(
              'absolute left-3 top-3 bottom-3 transition-transform',
              open ? 'translate-x-0' : '-translate-x-[110%]',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>

        <main className="flex-1 min-w-0 flex flex-col gap-4">
          <Topbar onMenu={() => setOpen(true)} />
          <div className="glass-panel p-4 sm:p-6 min-h-[60vh]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
