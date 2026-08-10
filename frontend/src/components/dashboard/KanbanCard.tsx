// One thesis card on the Kanban board — Banani `KanbanTheses.jsx`.
// Links to the student's detail page, same destination `StudentRow` uses
// elsewhere, so the board is a real navigation surface, not a preview-only
// widget.
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { displayName, formatDate, urgencyFromDueDate, type ThesisListItem } from '@/lib/theses';

const URGENCY_DOT: Record<'low' | 'medium' | 'high', string> = {
  high: 'bg-danger',
  medium: 'bg-warning',
  low: 'bg-success',
};

const URGENCY_LABEL: Record<'low' | 'medium' | 'high', string> = {
  high: 'Urgent',
  medium: 'Moyen',
  low: 'Normal',
};

const URGENCY_STYLE: Record<'low' | 'medium' | 'high', string> = {
  high: 'bg-danger text-danger-foreground',
  medium: 'bg-warning text-warning-foreground',
  low: 'bg-success text-success-foreground',
};

interface KanbanCardProps {
  thesis: ThesisListItem;
  draggable?: boolean;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
}

export function KanbanCard({
  thesis,
  draggable,
  isDragging,
  onDragStart,
  onDragEnd,
}: KanbanCardProps) {
  const deadline = thesis.deadlines[0] ?? null;
  const urgency = deadline ? urgencyFromDueDate(deadline.dueAt) : 'low';
  const commentCount = thesis._count.comments;

  return (
    <Link
      href={`/students/${thesis.id}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`flex flex-col gap-2.5 rounded-md border border-border bg-surface p-3 transition duration-150 hover:border-primary ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      } ${isDragging ? 'opacity-40' : 'opacity-100'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative shrink-0">
            <Avatar
              name={displayName(thesis.student)}
              src={thesis.student.avatarUrl}
              className="h-7 w-7"
            />
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-surface ${URGENCY_DOT[urgency]}`}
            />
          </div>
          <span className="truncate text-xs font-semibold text-foreground">
            {displayName(thesis.student)}
          </span>
        </div>
        <span
          className={`shrink-0 rounded-sm px-1.5 py-0.5 text-xs font-medium ${URGENCY_STYLE[urgency]}`}
        >
          {URGENCY_LABEL[urgency]}
        </span>
      </div>

      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{thesis.topic}</p>

      <div className="flex items-center justify-between border-t border-border pt-1">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Icon i="calendar" size={11} />
          <span>{deadline ? formatDate(deadline.dueAt) : 'Aucune échéance'}</span>
        </div>
        {commentCount > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Icon i="message-square" size={11} />
            <span>{commentCount}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

export function KanbanCardSkeleton() {
  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-4 w-12" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
      <div className="flex items-center justify-between border-t border-border pt-1">
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}
