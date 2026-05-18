import type { ComponentType } from 'react';
import { Card } from '@/components/ui/card';

export interface PlaceholderPageProps {
  title: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
}

export function PlaceholderPage({ title, description, icon: Icon }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-brand/15 text-brand grid place-items-center">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>

      <Card className="text-center py-12">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-brand/15 text-brand grid place-items-center mb-3">
          <Icon className="h-6 w-6" />
        </div>
        <h3 className="font-semibold">Coming soon</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          {title} is on the way. Content for this section will be added next.
        </p>
      </Card>
    </div>
  );
}
