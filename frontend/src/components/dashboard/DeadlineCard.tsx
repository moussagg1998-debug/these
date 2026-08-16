// Banani `DeadlineCard.jsx` — a single deadline row in the "Échéances —
// Calendrier" timeline. `urgency` here is the days-until-due bucket
// (deadlineUrgencyBucket) — distinct from the stored Deadline.urgency
// priority field. `daysLeft` drives the badge copy; `Avatar` replaces
// Banani's `UserAvatar` (see components/ui/Avatar.tsx).
//
// The "Marquer comme respectée" toggle calls PATCH /api/deadlines/[id] —
// encadrant-only validation that a deadline was genuinely met, so it stops
// rendering as "En retard" once dueAt passes. Same pattern as
// CommentThread's resolved toggle (components/dashboard/CommentThread.tsx).
'use client';

import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { displayName, formatDate, type DeadlineBucket, type DeadlineListItem } from '@/lib/theses';

const URGENCY_CLASS: Record<DeadlineBucket, string> = {
  critical: 'border-danger bg-danger/5',
  urgent: 'border-warning bg-warning/5',
  upcoming: 'border-secondary bg-secondary/5',
  future: 'border-border bg-surface',
  done: 'border-success bg-success/5',
};

const URGENCY_BADGE: Record<DeadlineBucket, string> = {
  critical: 'bg-danger text-danger-foreground',
  urgent: 'bg-warning text-warning-foreground',
  upcoming: 'bg-secondary text-secondary-foreground',
  future: 'bg-muted text-muted-foreground',
  done: 'bg-success text-success-foreground',
};

interface DeadlineCardProps {
  deadline: DeadlineListItem;
  daysLeft: number;
  bucket: DeadlineBucket;
  onCompletedChange: (id: string, completed: boolean) => void;
}

export function DeadlineCard({ deadline, daysLeft, bucket, onCompletedChange }: DeadlineCardProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const name = displayName(deadline.thesis.student);
  const isDone = bucket === 'done';

  async function toggleCompleted() {
    if (busy) return;
    setBusy(true);
    const next = !isDone;
    try {
      await api(`/api/deadlines/${deadline.id}`, { method: 'PATCH', body: { completed: next } });
      onCompletedChange(deadline.id, next);
      toast(next ? 'Échéance marquée respectée.' : 'Échéance rouverte.', 'success');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Une erreur est survenue', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`flex items-start gap-4 p-4 border rounded-md transition-shadow duration-150 motion-safe:hover:shadow-md ${URGENCY_CLASS[bucket]}`}
    >
      <Avatar name={name} src={deadline.thesis.student.avatarUrl} className="h-9 w-9" />

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
              {isDone
                ? 'Respectée'
                : daysLeft > 0
                  ? `${daysLeft} jour${daysLeft > 1 ? 's' : ''}`
                  : daysLeft === 0
                    ? "Aujourd'hui"
                    : `Retard: ${Math.abs(daysLeft)} j`}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatDate(deadline.dueAt)}</span>
          <div className="flex items-center gap-3">
            <span>{deadline.thesis.stage}</span>
            <button
              type="button"
              onClick={() => void toggleCompleted()}
              disabled={busy}
              className={`flex items-center gap-1 font-medium transition duration-150 motion-safe:active:scale-[0.97] disabled:opacity-50 ${
                isDone ? 'text-success' : 'text-primary'
              }`}
            >
              <Icon i={isDone ? 'check-circle' : 'circle'} size={12} />
              {isDone ? 'Respectée' : 'Marquer comme respectée'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DeadlineCardSkeleton() {
  return (
    <div className="flex items-start gap-4 p-4 border border-border rounded-md bg-surface">
      <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-36" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  );
}
