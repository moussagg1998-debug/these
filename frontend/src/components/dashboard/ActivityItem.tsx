// Banani `ActivityItem.jsx` — one line in the recent-activity feed.
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';

export type ActivityType = 'submit' | 'comment' | 'deadline' | 'revision';

const TYPE_ICON: Record<ActivityType, string> = {
  submit: 'file-up',
  comment: 'message-square',
  deadline: 'calendar-x',
  revision: 'pencil',
};

const TYPE_COLOR: Record<ActivityType, string> = {
  submit: 'text-success',
  comment: 'text-primary',
  deadline: 'text-danger',
  revision: 'text-accent',
};

interface ActivityItemProps {
  name: string;
  action: string;
  time: string;
  type: ActivityType;
}

export function ActivityItem({ name, action, time, type }: ActivityItemProps) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-b-0">
      <Avatar name={name} className="h-8 w-8 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-foreground">{name}</span>
          <span className="text-sm text-muted-foreground">{action}</span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <Icon i={TYPE_ICON[type]} size={12} className={TYPE_COLOR[type]} />
          <span className="text-xs text-muted-foreground">{time}</span>
        </div>
      </div>
    </div>
  );
}
