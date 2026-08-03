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
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StatCard } from '@/components/dashboard/StatCard';
import { StudentRow } from '@/components/dashboard/StudentRow';
import { ActivityItem } from '@/components/dashboard/ActivityItem';
import { AddStudentForm } from '@/components/dashboard/AddStudentForm';
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

interface ThesesResponse {
  items: ThesisListItem[];
  nextCursor: string | null;
}

export default function DashboardEncadrantPage() {
  const user = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: profile, loading: profileLoading } = useApi<ProfileResponse>('/api/profile', {
    skip: !user,
  });
  const {
    data: theses,
    loading: thesesLoading,
    refresh: refreshTheses,
  } = useApi<ThesesResponse>('/api/theses', {
    skip: !user || profile?.profileType !== 'ENCADRANT',
  });

  const items = useMemo(() => theses?.items ?? [], [theses]);

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
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </main>
    );
  }

  if (profileLoading || !profile) {
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
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <p className="text-sm text-muted-foreground">
          Ce tableau de bord est réservé aux encadrants.
        </p>
        <Link href="/" className="text-sm font-medium text-primary underline">
          Retour à l&apos;accueil
        </Link>
      </main>
    );
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
    <DashboardShell name={name}>
      <div className="flex items-center justify-between px-4 py-4 sm:px-8 bg-surface border-b border-border">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-0.5">
            Encadrement · Année 2024–2025
          </div>
          <h1 className="text-xl font-semibold font-headings text-foreground">Bonjour, {name}</h1>
        </div>
      </div>

      <div className="flex flex-1 flex-col xl:flex-row gap-0 min-w-0">
        <div className="flex-1 flex flex-col min-w-0 px-4 py-6 sm:px-8 gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Étudiants suivis"
              value={String(items.length)}
              sub={`${stats.soutenance} en soutenance`}
              icon="users"
              highlight
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
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold font-headings text-foreground">
                Mes thèses & mémoires
              </h2>
              <div className="flex items-center gap-2">
                <Link
                  href="/students"
                  className="text-xs font-medium text-muted-foreground border border-border rounded-sm px-3 py-1.5"
                >
                  Voir tout
                </Link>
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="text-xs font-medium text-primary border border-primary px-3 py-1.5 rounded-sm flex items-center gap-1.5"
                >
                  <Icon i="plus" size={12} />
                  Ajouter un étudiant
                </button>
              </div>
            </div>

            {thesesLoading && !theses ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : items.length === 0 ? (
              <div className="border border-dashed border-border rounded-md p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Aucun étudiant pour l&apos;instant — ajoutez-en un pour commencer le suivi.
                </p>
              </div>
            ) : (
              <div className="border border-border rounded-md overflow-hidden">
                <div className="hidden lg:flex items-center gap-4 px-5 py-2.5 bg-input border-b border-border">
                  <div className="w-72 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">
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
                  <div className="w-24 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Retours
                  </div>
                  <div className="flex-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Échéance
                  </div>
                  <div className="shrink-0 w-16" />
                </div>
                {items.slice(0, 7).map((thesis) => (
                  <StudentRow key={thesis.id} thesis={thesis} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="w-full xl:w-72 shrink-0 border-t xl:border-t-0 xl:border-l border-border bg-surface flex flex-col px-5 py-6 gap-5">
          <div>
            <h3 className="text-sm font-semibold font-headings text-foreground mb-1">
              Activité récente
            </h3>
            <p className="text-xs text-muted-foreground">Dernières soumissions</p>
          </div>
          <div className="flex flex-col">
            {recentActivity.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucune activité pour l&apos;instant.</p>
            ) : (
              recentActivity.map((thesis) => (
                <ActivityItem
                  key={thesis.id}
                  name={displayName(thesis.student)}
                  action="a soumis un document"
                  time={relativeTime(thesis.documents[0]!.uploadedAt)}
                  type="submit"
                />
              ))
            )}
          </div>

          <div className="mt-2">
            <h3 className="text-sm font-semibold font-headings text-foreground mb-3">
              Prochaines échéances
            </h3>
            <div className="flex flex-col gap-2">
              {upcomingDeadlines.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucune échéance à venir.</p>
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
        </div>
      </div>

      {modalOpen && (
        <AddStudentForm onClose={() => setModalOpen(false)} onCreated={onStudentCreated} />
      )}
    </DashboardShell>
  );
}
