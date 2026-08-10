import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';

interface AdminKpiCardProps {
  icon: string;
  label: string;
  value: string;
}

export function AdminKpiCard({ icon, label, value }: AdminKpiCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4">
      <Icon i={icon} size={14} className="text-muted-foreground" />
      <div className="text-xl font-bold font-headings leading-none text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function AdminKpiCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4">
      <Skeleton className="h-3.5 w-3.5" />
      <Skeleton className="h-6 w-10" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}
