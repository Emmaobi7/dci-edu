import { Link } from 'react-router-dom';
import { ArrowRight, Shield, Users as UsersIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';

export function AdminPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-brand/15 text-brand grid place-items-center">
          <Shield className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
          <p className="text-sm text-muted-foreground">
            System-wide controls. Visible only to administrators.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AdminCard
          to="/users"
          icon={UsersIcon}
          title="User management"
          description="View every account, promote students to faculty, grant admin access, or provision new users."
        />
      </div>
    </div>
  );
}

interface AdminCardProps {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

function AdminCard({ to, icon: Icon, title, description }: AdminCardProps) {
  return (
    <Link to={to} className="block">
      <Card className="p-5 flex items-start gap-4 hover:bg-white/70 transition-colors h-full">
        <div className="h-11 w-11 rounded-xl bg-brand/15 text-brand grid place-items-center shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">{title}</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
      </Card>
    </Link>
  );
}
