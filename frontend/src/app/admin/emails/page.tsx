// Admin — Monitoring des emails. KPI grid over EmailJob, mirroring the
// KPI-grid section of admin/page.tsx (same AdminKpiCard primitive, same
// gating pattern). Backed by GET /api/admin/email-stats.
'use client';

import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/ui/Icon';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminKpiCard, AdminKpiCardSkeleton } from '@/components/admin/AdminKpiCard';

interface AdminMeResponse {
  admin: { id: string; email: string; role: 'ADMIN' | 'SUPERADMIN' };
  can: string[];
}

interface EmailStatsResponse {
  windowHours: number;
  sent: number;
  delivered: number;
  bounced: number;
  failed: number;
  pending: number;
  verification: number;
  passwordReset: number;
  failureRatePct: number;
}

const NUMBER_FORMAT = new Intl.NumberFormat('fr-FR');

export default function AdminEmailsPage() {
  const user = useUser();
  const router = useRouter();

  const { data: me, error: meError } = useApi<AdminMeResponse>('/api/admin/me', { skip: !user });
  const { data: stats, loading: statsLoading } = useApi<EmailStatsResponse>(
    '/api/admin/email-stats',
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
        <div className="px-4 py-4 sm:px-8 bg-surface border-b border-border">
          <div className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-0.5">
            Administration
          </div>
          <h1 className="text-xl font-semibold font-headings text-foreground">
            Monitoring des emails
          </h1>
        </div>
      }
    >
      <div className="flex-1 flex flex-col gap-6 px-4 py-6 sm:px-8">
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">
            Email Delivery — dernières {stats?.windowHours ?? 24}h
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statsLoading && !stats ? (
              <>
                <AdminKpiCardSkeleton />
                <AdminKpiCardSkeleton />
                <AdminKpiCardSkeleton />
                <AdminKpiCardSkeleton />
                <AdminKpiCardSkeleton />
                <AdminKpiCardSkeleton />
                <AdminKpiCardSkeleton />
                <AdminKpiCardSkeleton />
              </>
            ) : (
              <>
                <AdminKpiCard
                  icon="send"
                  label="Envoyés"
                  value={NUMBER_FORMAT.format(stats?.sent ?? 0)}
                />
                <AdminKpiCard
                  icon="check-circle"
                  label="Délivrés"
                  value={NUMBER_FORMAT.format(stats?.delivered ?? 0)}
                />
                <AdminKpiCard
                  icon="alert-circle"
                  label="Rebonds"
                  value={NUMBER_FORMAT.format(stats?.bounced ?? 0)}
                />
                <AdminKpiCard
                  icon="alert-triangle"
                  label="Échoués"
                  value={NUMBER_FORMAT.format(stats?.failed ?? 0)}
                />
                <AdminKpiCard
                  icon="clock"
                  label="En attente"
                  value={NUMBER_FORMAT.format(stats?.pending ?? 0)}
                />
                <AdminKpiCard
                  icon="mail"
                  label="Emails de vérification"
                  value={NUMBER_FORMAT.format(stats?.verification ?? 0)}
                />
                <AdminKpiCard
                  icon="lock"
                  label="Réinitialisation de mot de passe"
                  value={NUMBER_FORMAT.format(stats?.passwordReset ?? 0)}
                />
                <AdminKpiCard
                  icon="activity"
                  label="Taux d'échec"
                  value={`${(stats?.failureRatePct ?? 0).toLocaleString('fr-FR')} %`}
                />
              </>
            )}
          </div>
        </div>

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Icon i="info" size={12} className="mt-0.5 shrink-0" />
          <span>
            « Délivrés » et « Rebonds » viennent du webhook Resend (/api/webhooks/resend) — tant
            qu&apos;il n&apos;est pas configuré dans le tableau de bord Resend (URL du webhook +{' '}
            <code>RESEND_WEBHOOK_SECRET</code>), ces deux compteurs restent à 0 même si les emails
            sont bien envoyés. « Échoués » regroupe les tentatives en cours de nouvel essai et les
            envois définitivement abandonnés après 5 tentatives.
          </span>
        </p>
      </div>
    </AdminShell>
  );
}
