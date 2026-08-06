// Banani `DeadlineCard.jsx` — a single deadline row in the "Échéances —
// Calendrier" timeline. `urgency` here is the days-until-due bucket
// (deadlineUrgencyBucket) — distinct from the stored Deadline.urgency
// priority field. `daysLeft` drives the badge copy; `Avatar` replaces
// Banani's `UserAvatar` (see components/ui/Avatar.tsx).
import { Avatar } from '@/components/ui/Avatar';
import { displayName, formatDate, type DeadlineBucket, type DeadlineListItem } from '@/lib/theses';

const URGENCY_CLASS: Record<DeadlineBucket, string> = {
  critical: 'border-danger bg-danger/5',
  urgent: 'border-warning bg-warning/5',
  upcoming: 'border-secondary bg-secondary/5',
  future: 'border-border bg-surface',
};

const URGENCY_BADGE: Record<DeadlineBucket, string> = {
  critical: 'bg-danger text-danger-foreground',
  urgent: 'bg-warning text-warning-foreground',
  upcoming: 'bg-secondary text-secondary-foreground',
  future: 'bg-muted text-muted-foreground',
};

interface DeadlineCardProps {
  deadline: DeadlineListItem;
  daysLeft: number;
  bucket: DeadlineBucket;
}

export function DeadlineCard({ deadline, daysLeft, bucket }: DeadlineCardProps) {
  const name = displayName(deadline.thesis.student);

  return (
    <div
      className={`flex items-start gap-4 p-4 border rounded-md transition-shadow duration-150 motion-safe:hover:shadow-md ${URGENCY_CLASS[bucket]}`}
    >
      <Avatar name={name} className="h-9 w-9" />

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <div className="font-medium text-sm text-foreground truncate">{name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {deadline.description || deadline.title}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div
              className={`text-xs font-semibold px-2 py-1 rounded-sm whitespace-nowrap ${URGENCY_BADGE[bucket]}`}
            >
              {daysLeft > 0
                ? `${daysLeft} jour${daysLeft > 1 ? 's' : ''}`
                : daysLeft === 0
                  ? "Aujourd'hui"
                  : `Retard: ${Math.abs(daysLeft)} j`}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatDate(deadline.dueAt)}</span>
          <span>{deadline.thesis.stage}</span>
        </div>
      </div>
    </div>
  );
}
