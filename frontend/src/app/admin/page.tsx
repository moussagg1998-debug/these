// Admin — Tableau de bord — Banani `new_screen9.jsx`.
//
// Option A scope (.planning/banani/admin-dashboard.md): only the metrics
// with real backing data are shown — no MRR, no "universités actives", no
// "comptes inactifs", no fabricated alerts. Gated on the pre-existing
// User.role field (ADMIN/SUPERADMIN) via GET /api/admin/me, the same
// role-check every /api/admin/* route already enforces server-side —
// unrelated to `profileType` (ENCADRANT/ETUDIANT), which every other page
// in the app gates on.
'use client';

import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/ui/Icon';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminKpiCard, AdminKpiCardSkeleton } from '@/components/admin/AdminKpiCard';
import { InstitutionsTable } from '@/components/admin/InstitutionsTable';
import { SystemAlerts } from '@/components/admin/SystemAlerts';
import { RecentSignups } from '@/components/admin/RecentSignups';

interface AdminMeResponse {
  admin: { id: string; email: string; role: 'ADMIN' | 'SUPERADMIN' };
  can: string[];
}

interface StatsResponse {
  encadrants: number;
  etudiants: number;
  theses: number;
}

interface InstitutionsResponse {
  items: { id: string; name: string; encadrants: number; students: number }[];
}

interface RecentUsersResponse {
  items: {
    id: string;
    name: string | null;
    email: string;
    profileType: 'ENCADRANT' | 'ETUDIANT' | null;
    institution: { name: string } | null;
    createdAt: string;
  }[];
}

const NUMBER_FORMAT = new Intl.NumberFormat('fr-FR');

export default function AdminDashboardPage() {
  const user = useUser();
  const router = useRouter();

  const { data: me, error: meError } = useApi<AdminMeResponse>('/api/admin/me', { skip: !user });
  const { data: stats, loading: statsLoading } = useApi<StatsResponse>('/api/admin/stats', {
    skip: !me,
  });
  const { data: institutions, loading: institutionsLoading } = useApi<InstitutionsResponse>(
    '/api/admin/institutions',
    { skip: !me },
  );
  const { data: recentUsers, loading: recentUsersLoading } = useApi<RecentUsersResponse>(
    '/api/admin/users?limit=5',
    { skip: !me },
  );

  if (!user) {
    return <LoadingScreen />;
  }

  if (meError) {
    router.replace('/dashboard');
    return null;
  }

  if (!me) {
    return <LoadingScreen />;
  }

  return (
    <AdminShell
      email={me.admin.email}
      role={me.admin.role}
      header={
        <div className="flex items-center justify-between px-8 py-4 bg-surface border-b border-border">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-0.5">
              Administration
            </div>
            <h1 className="text-xl font-semibold font-headings text-foreground">Tableau de bord</h1>
          </div>
        </div>
      }
    >
      <div className="flex-1 flex flex-col gap-6 px-4 py-6 sm:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {statsLoading && !stats ? (
            <>
              <AdminKpiCardSkeleton />
              <AdminKpiCardSkeleton />
              <AdminKpiCardSkeleton />
            </>
          ) : (
            <>
              <AdminKpiCard
                icon="user-check"
                label="Encadrants inscrits"
                value={NUMBER_FORMAT.format(stats?.encadrants ?? 0)}
              />
              <AdminKpiCard
                icon="users"
                label="Étudiants suivis"
                value={NUMBER_FORMAT.format(stats?.etudiants ?? 0)}
              />
              <AdminKpiCard
                icon="file-text"
                label="Thèses en cours"
                value={NUMBER_FORMAT.format(stats?.theses ?? 0)}
              />
            </>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <InstitutionsTable
            items={institutions?.items ?? []}
            loading={institutionsLoading && !institutions}
          />

          <div className="w-full lg:w-72 shrink-0 flex flex-col gap-4">
            <SystemAlerts />
            <RecentSignups
              items={recentUsers?.items ?? []}
              loading={recentUsersLoading && !recentUsers}
            />
          </div>
        </div>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon i="info" size={12} />
          MRR, statut/plan par établissement et alertes automatiques ne sont pas encore disponibles
          — aucun modèle d&apos;abonnement n&apos;existe dans le produit aujourd&apos;hui.
        </p>
      </div>
    </AdminShell>
  );
}
