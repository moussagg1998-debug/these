// Échéances — Calendrier — Banani `DeadlineCalendar.jsx` + `AddDeadline.jsx`.
//
// One route, not two (see .planning/banani/phase-5-deadlines.md § Routing
// decision): `AddDeadline.jsx` is the same calendar markup with
// `AddDeadlineForm` overlaid as a modal, same shape as /students +
// AddStudentForm. Cross-thesis aggregate — fetches GET /api/deadlines
// (uncapped by cursor, see the route's own comment) rather than a per-
// thesis nested route. Sections (En retard/Urgent/À venir) and filter tabs
// (Tous/Critiques/Ce mois/Prochains mois) are all computed client-side from
// the single fetched list, same pattern as Phase 4's aggregates.
'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/ui/Icon';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DeadlineCard } from '@/components/dashboard/DeadlineCard';
import { AddDeadlineForm } from '@/components/dashboard/AddDeadlineForm';
import { StudentCalendarContent } from '@/components/student/StudentCalendarContent';
import {
  daysUntil,
  deadlineUrgencyBucket,
  displayName,
  type DeadlineBucket,
  type DeadlineListItem,
  type ThesisDeadline,
  type ThesisListItem,
} from '@/lib/theses';

interface ProfileResponse {
  profileType: 'ENCADRANT' | 'ETUDIANT' | null;
  name: string | null;
  email: string;
}

interface DeadlinesResponse {
  items: DeadlineListItem[];
}

interface ThesesResponse {
  items: ThesisListItem[];
}

type FilterId = 'all' | 'critical' | 'month' | 'nextMonth';

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'critical', label: 'Critiques' },
  { id: 'month', label: 'Ce mois' },
  { id: 'nextMonth', label: 'Prochains mois' },
];

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

function DeadlineCalendarContent() {
  const user = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const studentIdFilter = searchParams.get('studentId');
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const [modalOpen, setModalOpen] = useState(false);

  const { data: profile, loading: profileLoading } = useApi<ProfileResponse>('/api/profile', {
    skip: !user,
  });
  const apiPath = studentIdFilter
    ? `/api/deadlines?studentId=${encodeURIComponent(studentIdFilter)}`
    : '/api/deadlines';
  const {
    data: deadlinesRes,
    loading: deadlinesLoading,
    refresh: refreshDeadlines,
  } = useApi<DeadlinesResponse>(apiPath, {
    skip: !user || profile?.profileType !== 'ENCADRANT',
  });
  const { data: theses } = useApi<ThesesResponse>('/api/theses', {
    skip: !user || profile?.profileType !== 'ENCADRANT',
  });

  const withBucket = useMemo(() => {
    const items = deadlinesRes?.items ?? [];
    return items.map((deadline) => ({
      deadline,
      daysLeft: daysUntil(deadline.dueAt),
      bucket: deadlineUrgencyBucket(deadline.dueAt),
    }));
  }, [deadlinesRes]);

  const counts = useMemo(() => {
    const result = { critical: 0, urgent: 0, upcoming: 0 };
    for (const { bucket } of withBucket) {
      if (bucket === 'critical') result.critical++;
      else if (bucket === 'urgent') result.urgent++;
      else result.upcoming++;
    }
    return result;
  }, [withBucket]);

  const filtered = useMemo(() => {
    const now = new Date();
    return withBucket.filter(({ deadline, bucket }) => {
      if (activeFilter === 'critical') return bucket === 'critical';
      if (activeFilter === 'month' || activeFilter === 'nextMonth') {
        const due = new Date(deadline.dueAt);
        const dueMonthIndex = due.getFullYear() * 12 + due.getMonth();
        const nowMonthIndex = now.getFullYear() * 12 + now.getMonth();
        if (activeFilter === 'month') return dueMonthIndex === nowMonthIndex;
        return dueMonthIndex > nowMonthIndex;
      }
      return true;
    });
  }, [withBucket, activeFilter]);

  function onDeadlineCreated(_deadline: ThesisDeadline, studentName: string) {
    setModalOpen(false);
    void refreshDeadlines();
    toast(`Échéance ajoutée${studentName ? ` pour ${studentName}` : ''}`, 'success');
  }

  if (!user || profileLoading || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </main>
    );
  }

  if (profile.profileType === null) {
    router.replace('/onboarding/profile');
    return null;
  }

  if (profile.profileType === 'ETUDIANT') {
    const studentName = profile.name || user.email.split('@')[0] || user.email;
    return <StudentCalendarContent name={studentName} />;
  }

  const name = profile.name || user.email.split('@')[0] || user.email;
  const studentName = studentIdFilter
    ? theses?.items.find((t) => t.student.id === studentIdFilter)?.student
    : null;

  return (
    <DashboardShell
      name={name}
      header={
        <div className="flex items-center justify-between px-4 py-4 sm:px-8 bg-surface border-b border-border">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-0.5">
              Encadrement · Année 2024–2025
            </div>
            <h1 className="text-xl font-semibold font-headings text-foreground">
              Échéances &amp; Jalons
            </h1>
          </div>
        </div>
      }
    >
      <div className="flex-1 flex flex-col min-w-0 px-4 py-6 sm:px-8">
        {studentIdFilter && studentName && (
          <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Filtré pour {displayName(studentName)}</span>
            <button
              type="button"
              onClick={() => router.push('/deadlines')}
              className="text-primary font-medium"
            >
              Retirer le filtre
            </button>
          </div>
        )}

        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-semibold font-headings text-foreground">
                Calendrier des dépôts
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {counts.critical} en retard · {counts.urgent} urgent{counts.urgent > 1 ? 's' : ''} ·{' '}
                {counts.upcoming} à venir
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="text-xs font-medium text-primary border border-primary px-3 py-1.5 rounded-sm flex items-center gap-1.5"
            >
              <Icon i="plus" size={12} />
              Ajouter une échéance
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFilter(f.id)}
                className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-sm ${
                  f.id === activeFilter
                    ? 'bg-primary text-primary-foreground'
                    : f.id === 'critical'
                      ? 'bg-danger/10 text-danger border border-danger'
                      : 'bg-surface border border-border text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {deadlinesLoading && !deadlinesRes ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed border-border rounded-md p-8 text-center">
            <p className="text-sm text-muted-foreground">Aucune échéance dans cette catégorie.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {SECTIONS.map((section) => {
              const rows = filtered.filter((row) => section.buckets.includes(row.bucket));
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
                      <DeadlineCard
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

      {modalOpen && theses && (
        <AddDeadlineForm
          theses={theses.items}
          onClose={() => setModalOpen(false)}
          onCreated={onDeadlineCreated}
        />
      )}
    </DashboardShell>
  );
}

export default function DeadlineCalendarPage() {
  return (
    <Suspense fallback={null}>
      <DeadlineCalendarContent />
    </Suspense>
  );
}
