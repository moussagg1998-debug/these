// Student "Calendrier" page — read-only list of the student's own thesis
// deadlines, grouped by urgency (same 3 sections/order as the encadrant's
// cross-thesis /deadlines page). No creation form: POST
// /api/theses/[id]/deadlines is ENCADRANT_ONLY server-side.
'use client';

import { useMemo } from 'react';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/ui/Icon';
import { StudentNav } from './StudentNav';
import { StudentDeadlineCard } from './StudentDeadlineCard';
import {
  daysUntil,
  deadlineUrgencyBucket,
  type DeadlineBucket,
  type ThesisDeadline,
  type ThesisListItem,
} from '@/lib/theses';

interface ThesesResponse {
  items: ThesisListItem[];
}

interface DeadlinesResponse {
  items: ThesisDeadline[];
}

const SECTIONS: {
  buckets: DeadlineBucket[];
  icon: string;
  label: string;
  headingClass: string;
  badgeClass: string;
  iconClass: string;
}[] = [
  {
    buckets: ['critical'],
    icon: 'alert-triangle',
    label: 'En retard',
    headingClass: 'text-danger',
    badgeClass: 'text-danger bg-danger/10',
    iconClass: 'text-danger',
  },
  {
    buckets: ['urgent'],
    icon: 'clock',
    label: 'Urgent',
    headingClass: 'text-warning',
    badgeClass: 'text-warning bg-warning/10',
    iconClass: 'text-warning',
  },
  {
    buckets: ['upcoming', 'future'],
    icon: 'calendar',
    label: 'À venir',
    headingClass: 'text-foreground',
    badgeClass: 'text-secondary-foreground bg-secondary',
    iconClass: 'text-secondary-foreground',
  },
];

interface StudentCalendarContentProps {
  name: string;
}

export function StudentCalendarContent({ name }: StudentCalendarContentProps) {
  const { data: thesesRes, loading: thesesLoading } = useApi<ThesesResponse>('/api/theses');
  const thesis = thesesRes?.items[0] ?? null;
  const thesisPath = thesis ? thesis.id : 'pending';

  const { data: deadlinesRes } = useApi<DeadlinesResponse>(`/api/theses/${thesisPath}/deadlines`, {
    skip: !thesis,
  });

  const withBucket = useMemo(() => {
    const items = deadlinesRes?.items ?? [];
    return items.map((deadline) => ({
      deadline,
      daysLeft: daysUntil(deadline.dueAt),
      bucket: deadlineUrgencyBucket(deadline.dueAt),
    }));
  }, [deadlinesRes]);

  if (thesesLoading && !thesesRes) {
    return (
      <div className="font-body bg-background min-h-screen">
        <StudentNav name={name} active="deadlines" />
        <p className="p-8 text-sm text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  if (!thesis) {
    return (
      <div className="font-body bg-background min-h-screen">
        <StudentNav name={name} active="deadlines" />
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-24 text-center">
          <p className="text-sm text-muted-foreground">
            Aucun encadrant ne vous a encore assigné de mémoire.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="font-body bg-background min-h-screen">
      <StudentNav name={name} active="deadlines" />
      <div className="px-4 py-6 sm:px-8">
        {withBucket.length === 0 ? (
          <div className="border border-dashed border-border rounded-md p-8 text-center">
            <p className="text-sm text-muted-foreground">Aucune échéance à venir.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {SECTIONS.map((section) => {
              const rows = withBucket.filter((row) => section.buckets.includes(row.bucket));
              if (rows.length === 0) return null;
              return (
                <div key={section.label}>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                    <Icon i={section.icon} size={16} className={section.iconClass} />
                    <h3 className={`text-sm font-semibold font-headings ${section.headingClass}`}>
                      {section.label}
                    </h3>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-sm ${section.badgeClass}`}
                    >
                      {rows.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {rows.map(({ deadline, daysLeft, bucket }) => (
                      <StudentDeadlineCard
                        key={deadline.id}
                        deadline={deadline}
                        daysLeft={daysLeft}
                        bucket={bucket}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
