// "Rappels groupés" (Banani `new_screen8.jsx`) — one selectable recipient
// row. Mirrors StudentRow's data derivation (avatar, urgency dot, last
// submission) but swaps the "Ouvrir" link for a checkbox.
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  URGENCY_DOT,
  displayName,
  relativeTime,
  urgencyFromDueDate,
  type ThesisListItem,
} from '@/lib/theses';

interface ReminderRecipientRowProps {
  thesis: ThesisListItem;
  selected: boolean;
  onToggle: (thesisId: string) => void;
}

export function ReminderRecipientRow({ thesis, selected, onToggle }: ReminderRecipientRowProps) {
  const name = displayName(thesis.student);
  const deadline = thesis.deadlines[0];
  const urgency = deadline ? urgencyFromDueDate(deadline.dueAt) : 'low';
  const dotClass = URGENCY_DOT[urgency] || 'bg-muted';
  const lastDoc = thesis.documents[0];

  return (
    <label
      className={`flex items-center gap-4 px-4 py-3 border-b border-border last:border-0 cursor-pointer transition-colors duration-150 hover:bg-input/40 ${
        selected ? '' : 'opacity-50'
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(thesis.id)}
        className="sr-only"
      />
      <span
        className={`w-5 h-5 sm:w-4 sm:h-4 rounded-sm border-2 flex items-center justify-center shrink-0 ${
          selected ? 'bg-primary border-primary' : 'border-border bg-background'
        }`}
        aria-hidden="true"
      >
        {selected && <Icon i="check" size={10} className="text-primary-foreground" />}
      </span>

      <span className="relative shrink-0">
        <Avatar name={name} src={thesis.student.avatarUrl} className="h-8 w-8" />
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-surface ${dotClass}`}
          aria-hidden="true"
        />
      </span>

      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-foreground truncate">{name}</span>
        <span className="block text-xs text-muted-foreground truncate">{thesis.topic}</span>
      </span>

      <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
        Dernière soumission : {lastDoc ? relativeTime(lastDoc.uploadedAt) : 'Aucune'}
      </span>
    </label>
  );
}

export function ReminderRecipientRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0">
      <Skeleton className="h-5 w-5 sm:h-4 sm:w-4 rounded-sm" />
      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-40" />
      </div>
      <Skeleton className="hidden sm:block h-3 w-32" />
    </div>
  );
}
