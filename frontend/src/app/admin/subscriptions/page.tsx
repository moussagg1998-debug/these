// Admin — Abonnements. Read-only view of who is subscribed (plan
// Essentiel), for how long, and an estimated MRR — wiring the sidebar's
// previously-inert "Abonnements" entry to real data now that the Chariow
// subscription integration + entitlements system both exist.
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Skeleton } from '@/components/ui/Skeleton';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminKpiCard, AdminKpiCardSkeleton } from '@/components/admin/AdminKpiCard';

interface AdminMeResponse {
  admin: { id: string; email: string; role: 'ADMIN' | 'SUPERADMIN' };
  can: string[];
}

interface SubscriptionsStatsResponse {
  essentielActive: number;
  essentielExpiredUnswept: number;
  free: number;
  mrrFcfa: number;
}

interface SubscriberListItem {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  plan: 'ESSENTIEL';
  planExpiresAt: string | null;
  createdAt: string;
}

interface SubscriptionsListResponse {
  items: SubscriberListItem[];
}

const NUMBER_FORMAT = new Intl.NumberFormat('fr-FR');
const SOON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type SubStatus = 'active' | 'soon' | 'expired';

const STATUS_LABELS: Record<SubStatus, string> = {
  active: 'Actif',
  soon: 'Expire bientôt',
  expired: 'Expiré — non traité',
};

const STATUS_BADGE: Record<SubStatus, string> = {
  active: 'bg-success/15 text-success',
  soon: 'bg-warning/15 text-warning',
  expired: 'bg-danger/15 text-danger',
};

function displayName(u: SubscriberListItem): string {
  return u.name?.trim() || u.email;
}

function subscriberStatus(planExpiresAt: string | null): SubStatus {
  if (!planExpiresAt) return 'active';
  const diff = new Date(planExpiresAt).getTime() - Date.now();
  if (diff < 0) return 'expired';
  if (diff <= SOON_WINDOW_MS) return 'soon';
  return 'active';
}

function formatExpiry(planExpiresAt: string | null): string {
  if (!planExpiresAt) return '—';
  return new Date(planExpiresAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function AdminSubscriptionsPage() {
  const user = useUser();
  const router = useRouter();

  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setQ(qInput.trim()), 300);
    return () => clearTimeout(id);
  }, [qInput]);

  const { data: me, error: meError } = useApi<AdminMeResponse>('/api/admin/me', { skip: !user });
  const { data: stats, loading: statsLoading } = useApi<SubscriptionsStatsResponse>(
    '/api/admin/subscriptions/stats',
    { skip: !me },
  );

  const apiPath = useMemo(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    const qs = params.toString();
    return qs ? `/api/admin/subscriptions?${qs}` : '/api/admin/subscriptions';
  }, [q]);

  const { data: subsRes, loading: subsLoading } = useApi<SubscriptionsListResponse>(apiPath, {
    skip: !me,
  });

  const items = subsRes?.items ?? [];

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
          <h1 className="text-xl font-semibold font-headings text-foreground">Abonnements</h1>
        </div>
      }
    >
      <div className="flex-1 flex flex-col gap-6 px-4 py-6 sm:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {statsLoading && !stats ? (
            <>
              <AdminKpiCardSkeleton />
              <AdminKpiCardSkeleton />
              <AdminKpiCardSkeleton />
            </>
          ) : (
            <>
              <AdminKpiCard
                icon="star"
                label="Essentiel actifs"
                value={NUMBER_FORMAT.format(stats?.essentielActive ?? 0)}
              />
              <AdminKpiCard
                icon="user"
                label="Gratuit"
                value={NUMBER_FORMAT.format(stats?.free ?? 0)}
              />
              <AdminKpiCard
                icon="bar-chart-2"
                label="MRR estimé"
                value={`${NUMBER_FORMAT.format(stats?.mrrFcfa ?? 0)} FCFA`}
              />
            </>
          )}
        </div>

        {stats && stats.essentielExpiredUnswept > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon i="info" size={12} />
            {stats.essentielExpiredUnswept} abonnement
            {stats.essentielExpiredUnswept > 1 ? 's' : ''} en attente de traitement par la tâche
            planifiée.
          </p>
        )}

        <div className="relative max-w-sm">
          <Icon
            i="search"
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Rechercher par nom ou email…"
            className="w-full rounded-md border border-border bg-input pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="rounded-md border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[560px]">
              <div className="grid grid-cols-[2fr_160px_160px] gap-2 px-5 py-2 border-b border-border bg-background">
                {['Abonné', 'Expire le', 'Statut'].map((h) => (
                  <div
                    key={h}
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </div>
                ))}
              </div>

              {subsLoading && items.length === 0 ? (
                [0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[2fr_160px_160px] gap-2 items-center px-5 py-3 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                ))
              ) : items.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground motion-safe:animate-fade-in">
                  Aucun abonné ne correspond à cette recherche.
                </p>
              ) : (
                items.map((s) => {
                  const status = subscriberStatus(s.planExpiresAt);
                  return (
                    <div
                      key={s.id}
                      className="grid grid-cols-[2fr_160px_160px] gap-2 items-center px-5 py-3 border-b border-border last:border-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar
                          name={displayName(s)}
                          src={s.avatarUrl}
                          className="h-8 w-8 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {displayName(s)}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{s.email}</div>
                        </div>
                      </div>
                      <div className="text-sm text-foreground">{formatExpiry(s.planExpiresAt)}</div>
                      <div>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}
                        >
                          {STATUS_LABELS[status]}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {items.length === 200 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon i="info" size={12} />
            Affichage limité aux 200 premiers abonnés.
          </p>
        )}
      </div>
    </AdminShell>
  );
}
