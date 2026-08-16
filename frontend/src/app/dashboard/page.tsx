// Dashboard Encadrant — Banani `DashboardEncadrant.jsx`.
//
// KPIs, "Activité récente", and "Prochaines échéances" are all derived from
// the real /api/theses list rather than Banani's separate hardcoded mock
// arrays (no unmodeled Activity table exists nor is warranted for an MVP —
// see .planning/banani/phase-3-encadrant-core.md § Deliberate simplifications).
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/ui/Icon';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { StatCard, StatCardSkeleton } from '@/components/dashboard/StatCard';
import { StudentRow, StudentRowSkeleton } from '@/components/dashboard/StudentRow';
import { ActivityItem, ActivityItemSkeleton } from '@/components/dashboard/ActivityItem';
import { Skeleton } from '@/components/ui/Skeleton';
import { AddStudentForm } from '@/components/dashboard/AddStudentForm';
import { FilterBar, STAGE_FILTERS, type StageFilterId } from '@/components/dashboard/FilterBar';
import { StudentDashboardContent } from '@/components/student/StudentDashboardContent';
import {
  displayName,
  formatDate,
  relativeTime,
  urgencyFromDueDate,
  type ThesisListItem,
} from '@/lib/theses';

interface ProfileResponse {
  profileType: 'ENCADRANT' | 'ETUDIANT' | null;
  name: string | null;
  email: string;
}

interface AdminMeResponse {
  admin: { id: string; email: string; role: 'ADMIN' | 'SUPERADMIN' };
}

interface ThesesResponse {
  items: ThesisListItem[];
  nextCursor: string | null;
  total: number;
}

export default function DashboardEncadrantPage() {
  const user = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<StageFilterId>('all');

  const { data: profile, loading: profileLoading } = useApi<ProfileResponse>('/api/profile', {
    skip: !user,
  });
  // Admin visibility, not profile visibility: role (ADMIN/SUPERADMIN) is
  // orthogonal to profileType. /api/admin/me 403s for non-admins — that's
  // the real server-side gate /admin itself enforces, so this button only
  // ever appears for accounts that can actually get past it.
  const { data: adminMe } = useApi<AdminMeResponse>('/api/admin/me', { skip: !user });
  const isAdmin = !!adminMe;
  const {
    data: theses,
    loading: thesesLoading,
    refresh: refreshTheses,
  } = useApi<ThesesResponse>('/api/theses', {
    skip: !user || profile?.profileType !== 'ENCADRANT',
  });

  const items = useMemo(() => theses?.items ?? [], [theses]);

  const counts = useMemo(() => {
    const result: Record<StageFilterId, number> = {
      all: items.length,
      writing: 0,
      revision: 0,
      defense: 0,
      waiting: 0,
      blocked: 0,
    };
    for (const filter of STAGE_FILTERS) {
      if (filter.stage) result[filter.id] = items.filter((t) => t.stage === filter.stage).length;
    }
    return result;
  }, [items]);

  const visibleItems = useMemo(() => {
    const filterDef = STAGE_FILTERS.find((f) => f.id === activeFilter);
    const byStage = filterDef?.stage ? items.filter((t) => t.stage === filterDef.stage) : items;
    const q = search.trim().toLowerCase();
    if (!q) return byStage;
    return byStage.filter(
      (t) =>
        displayName(t.student).toLowerCase().includes(q) ||
        t.student.email.toLowerCase().includes(q) ||
        t.topic.toLowerCase().includes(q),
    );
  }, [items, activeFilter, search]);

  const stats = useMemo(() => {
    const soutenance = items.filter((t) => t.stage === 'Soutenance').length;
    const withComments = items.filter((t) => t._count.comments > 0).length;
    const totalComments = items.reduce((sum, t) => sum + t._count.comments, 0);
    const now = Date.now();
    const submittedThisWeek = items.filter((t) => {
      const doc = t.documents[0];
      return doc && now - new Date(doc.uploadedAt).getTime() < 7 * 86_400_000;
    }).length;
    const urgent = items.filter(
      (t) => t.deadlines[0] && urgencyFromDueDate(t.deadlines[0].dueAt) === 'high',
    );
    return { soutenance, withComments, totalComments, submittedThisWeek, urgent };
  }, [items]);

  const initialLoading = thesesLoading && !theses;

  const upcomingDeadlines = useMemo(
    () =>
      items
        .filter((t) => t.deadlines[0])
        .sort(
          (a, b) =>
            new Date(a.deadlines[0]!.dueAt).getTime() - new Date(b.deadlines[0]!.dueAt).getTime(),
        )
        .slice(0, 3),
    [items],
  );

  const recentActivity = useMemo(
    () =>
      items
        .filter((t) => t.documents[0])
        .sort(
          (a, b) =>
            new Date(b.documents[0]!.uploadedAt).getTime() -
            new Date(a.documents[0]!.uploadedAt).getTime(),
        )
        .slice(0, 5),
    [items],
  );

  if (!user) {
    return <LoadingScreen />;
  }

  if (profileLoading || !profile) {
    return <LoadingScreen />;
  }

  if (profile.profileType === null) {
    router.replace('/onboarding/profile');
    return null;
  }

  if (profile.profileType === 'ETUDIANT') {
    const studentName = profile.name || user.email.split('@')[0] || user.email;
    return <StudentDashboardContent name={studentName} />;
  }

  const name = profile.name || user.email.split('@')[0] || user.email;

  function onStudentCreated(
    thesis: ThesisListItem & { student: { name: string | null; email: string } },
  ) {
    setModalOpen(false);
    void refreshTheses();
    toast(
      `${thesis.student.name || thesis.student.email} a été ajouté(e) à votre liste d'encadrement`,
      'success',
    );
  }

  return (
    <DashboardShell
      name={name}
      header={
        <DashboardHeader
          eyebrow="Encadrement"
          title={`Bonjour, ${name}`}
          search={{ value: search, onChange: setSearch, placeholder: 'Rechercher un étudiant…' }}
          actions={
            isAdmin ? (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 rounded-sm border border-primary px-3 py-2 text-xs font-medium text-primary transition-colors duration-150 hover:bg-primary hover:text-primary-foreground"
              >
                <Icon i="shield" size={12} />
                Admin
              </Link>
            ) : undefined
          }
        />
      }
    >
      <div className="flex flex-1 flex-col lg:flex-row gap-0 min-w-0">
        <div className="flex-1 flex flex-col min-w-0 px-4 py-6 sm:px-8 gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {initialLoading ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : (
              <>
                <StatCard
                  label="Étudiants suivis"
                  value={String(theses?.total ?? items.length)}
                  sub={`${stats.soutenance} en soutenance`}
                  icon="users"
                />
                <StatCard
                  label="Discussions actives"
                  value={String(stats.withComments)}
                  sub={`${stats.totalComments} commentaire${stats.totalComments > 1 ? 's' : ''} au total`}
                  icon="message-square"
                />
                <StatCard
                  label="Soumissions récentes"
                  value={String(stats.submittedThisWeek)}
                  sub="Cette semaine"
                  icon="file-up"
                />
                <StatCard
                  label="Échéances urgentes"
                  value={String(stats.urgent.length)}
                  sub={stats.urgent.length > 0 ? 'À moins de 3 jours' : 'Aucune'}
                  icon="alert-triangle"
                />
              </>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold font-headings text-foreground">
                Mes thèses & mémoires
              </h2>
              <div className="flex items-center gap-2">
                <Link
                  href="/students/kanban"
                  className="text-xs font-medium text-muted-foreground border border-border rounded-sm px-3 py-1.5 flex items-center gap-1.5 transition-colors duration-150 hover:bg-input"
                >
                  <Icon i="layout-dashboard" size={12} />
                  Kanban
                </Link>
                <Link
                  href="/students"
                  className="text-xs font-medium text-muted-foreground border border-border rounded-sm px-3 py-1.5 transition-colors duration-150 hover:bg-input"
                >
                  Voir tout
                </Link>
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="text-xs font-medium text-primary border border-primary px-3 py-1.5 rounded-sm flex items-center gap-1.5 transition duration-150 hover:bg-primary/5 motion-safe:active:scale-[0.98]"
                >
                  <Icon i="plus" size={12} />
                  Ajouter un étudiant
                </button>
              </div>
            </div>

            <div className="mb-3">
              <FilterBar active={activeFilter} onChange={setActiveFilter} counts={counts} />
            </div>

            {initialLoading ? (
              <div className="border border-border rounded-md overflow-hidden">
                <StudentRowSkeleton />
                <StudentRowSkeleton />
                <StudentRowSkeleton />
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="border border-dashed border-border rounded-md p-8 text-center motion-safe:animate-fade-in">
                <p className="text-sm text-muted-foreground">
                  {items.length === 0
                    ? "Aucun étudiant pour l'instant — ajoutez-en un pour commencer le suivi."
                    : 'Aucun résultat pour ce filtre ou cette recherche.'}
                </p>
              </div>
            ) : (
              <div className="border border-border rounded-md overflow-x-auto overflow-y-hidden">
                <div className="hidden lg:flex items-center gap-4 px-5 py-2.5 bg-input border-b border-border min-w-max">
                  <div className="w-64 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Étudiant · Sujet
                  </div>
                  <div className="w-28 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Étape
                  </div>
                  <div className="w-36 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Avancement
                  </div>
                  <div className="w-36 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Dernière soumission
                  </div>
                  <div className="w-20 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Retours
                  </div>
                  <div className="flex-1 min-w-[160px] text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Échéance
                  </div>
                  <div className="shrink-0 w-20" />
                </div>
                <div className="min-w-max max-h-48 overflow-y-auto">
                  {visibleItems.slice(0, 7).map((thesis) => (
                    <StudentRow key={thesis.id} thesis={thesis} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="w-full lg:w-72 shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-surface flex flex-col px-5 py-6 gap-5">
          <div>
            <h3 className="text-sm font-semibold font-headings text-foreground mb-1">
              Activité récente
            </h3>
            <p className="text-xs text-muted-foreground">Dernières soumissions</p>
          </div>
          <div className="flex flex-col max-h-72 overflow-y-scroll overflow-x-hidden">
            {initialLoading ? (
              <>
                <ActivityItemSkeleton />
                <ActivityItemSkeleton />
                <ActivityItemSkeleton />
              </>
            ) : recentActivity.length === 0 ? (
              <p className="text-xs text-muted-foreground motion-safe:animate-fade-in">
                Aucune activité pour l&apos;instant.
              </p>
            ) : (
              recentActivity.map((thesis) => (
                <ActivityItem
                  key={thesis.id}
                  name={displayName(thesis.student)}
                  avatarUrl={thesis.student.avatarUrl}
                  action="a soumis un document"
                  time={relativeTime(thesis.documents[0]!.uploadedAt)}
                  type="submit"
                />
              ))
            )}
          </div>

          <div className="mt-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold font-headings text-foreground">
                Prochaines échéances
              </h3>
              <Link href="/deadlines" className="text-xs font-medium text-primary">
                Voir tout
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              {initialLoading ? (
                <>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <div className="flex flex-col gap-1.5">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-5 w-14" />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div className="flex flex-col gap-1.5">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-5 w-14" />
                  </div>
                </>
              ) : upcomingDeadlines.length === 0 ? (
                <p className="text-xs text-muted-foreground motion-safe:animate-fade-in">
                  Aucune échéance à venir.
                </p>
              ) : (
                upcomingDeadlines.map((thesis) => {
                  const deadline = thesis.deadlines[0]!;
                  const urgency = urgencyFromDueDate(deadline.dueAt);
                  const chipClass =
                    urgency === 'high'
                      ? 'bg-danger text-danger-foreground'
                      : urgency === 'medium'
                        ? 'bg-warning text-warning-foreground'
                        : 'bg-muted text-muted-foreground';
                  return (
                    <div
                      key={thesis.id}
                      className="flex items-center justify-between py-2 border-b border-border last:border-b-0"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {displayName(thesis.student)}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {deadline.title}
                        </div>
                      </div>
                      <div
                        className={`text-xs font-semibold px-2 py-1 rounded-sm shrink-0 ${chipClass}`}
                      >
                        {formatDate(deadline.dueAt)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <Link
            href="/students/reminders"
            className="mt-auto w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-medium py-2.5 rounded-sm transition-opacity duration-150 hover:opacity-90"
          >
            <Icon i="send" size={14} />
            Envoyer des rappels groupés
          </Link>
        </div>
      </div>

      {modalOpen && (
        <AddStudentForm onClose={() => setModalOpen(false)} onCreated={onStudentCreated} />
      )}
    </DashboardShell>
  );
}
