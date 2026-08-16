// Banani `StatCard.jsx` — a single KPI tile for the dashboard.
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
  icon: string;
  highlight?: boolean;
}

export function StatCard({ label, value, sub, icon, highlight = false }: StatCardProps) {
  return (
    <div
      className={`flex flex-col gap-3 px-5 py-4 rounded-md border transition duration-150 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md ${
        highlight
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-surface text-foreground border-border'
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-medium uppercase tracking-widest ${
            highlight ? 'text-primary-foreground opacity-70' : 'text-muted-foreground'
          }`}
        >
          {label}
        </span>
        <Icon
          i={icon}
          size={15}
          className={highlight ? 'text-primary-foreground opacity-60' : 'text-muted-foreground'}
        />
      </div>
      <AnimatedNumber
        value={value}
        className={`text-3xl font-semibold font-headings leading-none ${
          highlight ? 'text-primary-foreground' : 'text-foreground'
        }`}
      />
      <div
        className={`text-xs ${highlight ? 'text-primary-foreground opacity-60' : 'text-muted-foreground'}`}
      >
        {sub}
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 rounded-md border border-border bg-surface">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
      <Skeleton className="h-8 w-12" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}
