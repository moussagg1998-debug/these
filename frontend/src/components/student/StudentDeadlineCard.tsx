// Simpler than the encadrant `DeadlineCard` (components/dashboard/) — that
// one expects a cross-thesis DeadlineListItem with a nested `thesis.student`
// and `thesis.stage` (for the avatar/name/stage shown when an encadrant
// browses deadlines across all their students). This one is already "my"
// deadline, on a plain ThesisDeadline — no such nesting exists to read from.
'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { AddToCalendarModal } from './AddToCalendarModal';
import { formatDate, type DeadlineBucket, type ThesisDeadline } from '@/lib/theses';

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

interface StudentDeadlineCardProps {
  deadline: ThesisDeadline;
  daysLeft: number;
  bucket: DeadlineBucket;
}

export function StudentDeadlineCard({ deadline, daysLeft, bucket }: StudentDeadlineCardProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  return (
    <div
      className={`flex items-start gap-4 p-4 border rounded-md transition-shadow duration-150 motion-safe:hover:shadow-md ${URGENCY_CLASS[bucket]}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <div className="font-medium text-sm text-foreground truncate">{deadline.title}</div>
            {deadline.description && (
              <div className="text-xs text-muted-foreground truncate">{deadline.description}</div>
            )}
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
          <button
            type="button"
            onClick={() => setCalendarOpen(true)}
            className="flex items-center gap-1 text-primary font-medium"
          >
            <Icon i="calendar-plus" size={12} />
            Ajouter au calendrier
          </button>
        </div>
      </div>

      {calendarOpen && (
        <AddToCalendarModal deadline={deadline} onClose={() => setCalendarOpen(false)} />
      )}
    </div>
  );
}
