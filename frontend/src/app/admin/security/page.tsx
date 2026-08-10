// Admin — Sécurité. KPI grid (same AdminKpiCard primitive as /admin/emails)
// over SecurityEvent + live anomaly flags, a filterable event feed, and a
// link to the dedicated /admin/audit-log ledger (Admin → Audit Log — the
// "actions sensibles" side of this feature; kept as its own page rather
// than folded in here, same split as Monitoring vs. Centre d'alertes).
//
// "Comptes actifs (24h)" is an honestly-labeled approximation — this app
// has no session store (stateless JWT, no revocation list beyond
// tokenVersion), so true concurrent-session data does not exist. Distinct
// accounts with a LOGIN_SUCCESS in the window is the closest real signal.
//
// "Changements d'adresse email" is intentionally not shown — no
// self-service email-change feature exists anywhere in this codebase
// (PATCH /api/profile has no `email` field), so there is no real data to
// display; an always-zero card would itself be a form of fabrication.
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/ui/Icon';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminKpiCard, AdminKpiCardSkeleton } from '@/components/admin/AdminKpiCard';
import { formatTime } from '@/lib/monitoring';

interface AdminMeResponse {
  admin: { id: string; email: string; role: 'ADMIN' | 'SUPERADMIN' };
  can: string[];
}

interface SecuritySummaryResponse {
  windowHours: number;
  adminLogins24h: number;
  failedLogins24h: number;
  passwordChanges24h: number;
  activeAccounts24h: number;
  unusualActivityCount: number;
}

type SecurityEventType = 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'PASSWORD_CHANGED';

interface SecurityEventRow {
  id: string;
  type: SecurityEventType;
  userId: string | null;
  email: string;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface SecurityEventsResponse {
  items: SecurityEventRow[];
  nextCursor: string | null;
}

interface AnomalyFlag {
  kind: 'REPEATED_FAILED_LOGIN' | 'IP_SPRAY' | 'NEW_IP_ADMIN_LOGIN';
  detail: string;
  count: number;
  since: string;
}

interface AnomaliesResponse {
  anomalies: AnomalyFlag[];
}

const NUMBER_FORMAT = new Intl.NumberFormat('fr-FR');

const EVENT_TYPE_LABELS: Record<SecurityEventType, string> = {
  LOGIN_SUCCESS: 'Connexion réussie',
  LOGIN_FAILED: 'Connexion échouée',
  PASSWORD_CHANGED: 'Mot de passe changé',
};

const EVENT_TYPE_BADGE: Record<SecurityEventType, string> = {
  LOGIN_SUCCESS: 'bg-success/15 text-success',
  LOGIN_FAILED: 'bg-danger/15 text-danger',
  PASSWORD_CHANGED: 'bg-warning/15 text-warning',
};

function dateLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR')} à ${formatTime(iso)}`;
}

export default function AdminSecurityPage() {
  const user = useUser();
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState('');

  const { data: me, error: meError } = useApi<AdminMeResponse>('/api/admin/me', { skip: !user });
  const { data: summary, loading: summaryLoading } = useApi<SecuritySummaryResponse>(
    '/api/admin/security/summary',
    { skip: !me },
  );
  const { data: anomaliesRes, loading: anomaliesLoading } = useApi<AnomaliesResponse>(
    '/api/admin/security/anomalies',
    { skip: !me },
  );
  const eventsPath = typeFilter
    ? `/api/admin/security/events?type=${typeFilter}`
    : '/api/admin/security/events';
  const { data: eventsRes, loading: eventsLoading } = useApi<SecurityEventsResponse>(eventsPath, {
    skip: !me,
  });

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

  const anomalies = anomaliesRes?.anomalies ?? [];

  return (
    <AdminShell
      email={me.admin.email}
      role={me.admin.role}
      header={
        <div className="px-4 py-4 sm:px-8 bg-surface border-b border-border">
          <div className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-0.5">
            Administration
          </div>
          <h1 className="text-xl font-semibold font-headings text-foreground">Sécurité</h1>
        </div>
      }
    >
      <div className="flex-1 flex flex-col gap-6 px-4 py-6 sm:px-8">
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">
            Dernières {summary?.windowHours ?? 24}h
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {summaryLoading && !summary ? (
              <>
                <AdminKpiCardSkeleton />
                <AdminKpiCardSkeleton />
                <AdminKpiCardSkeleton />
                <AdminKpiCardSkeleton />
                <AdminKpiCardSkeleton />
              </>
            ) : (
              <>
                <AdminKpiCard
                  icon="log-in"
                  label="Connexions admin"
                  value={NUMBER_FORMAT.format(summary?.adminLogins24h ?? 0)}
                />
                <AdminKpiCard
                  icon="alert-triangle"
                  label="Tentatives échouées"
                  value={NUMBER_FORMAT.format(summary?.failedLogins24h ?? 0)}
                />
                <AdminKpiCard
                  icon="lock"
                  label="Mots de passe changés"
                  value={NUMBER_FORMAT.format(summary?.passwordChanges24h ?? 0)}
                />
                <AdminKpiCard
                  icon="users"
                  label="Comptes actifs (approximation)"
                  value={NUMBER_FORMAT.format(summary?.activeAccounts24h ?? 0)}
                />
                <AdminKpiCard
                  icon="shield"
                  label="Anomalies détectées"
                  value={NUMBER_FORMAT.format(summary?.unusualActivityCount ?? 0)}
                />
              </>
            )}
          </div>
          <p className="flex items-start gap-1.5 mt-3 text-xs text-muted-foreground">
            <Icon i="info" size={12} className="mt-0.5 shrink-0" />
            <span>
              « Comptes actifs » compte les comptes distincts avec une connexion réussie sur la
              période — ce n&apos;est pas un nombre de sessions concurrentes réelles (l&apos;auth de
              ce projet est un JWT sans état, sans registre de sessions).
            </span>
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">
            Anomalies {anomalies.length > 0 && `(${anomalies.length})`}
          </h2>
          {anomaliesLoading && !anomaliesRes ? (
            <div className="rounded-md border border-border bg-surface px-4 py-4 text-sm text-muted-foreground">
              Chargement…
            </div>
          ) : anomalies.length === 0 ? (
            <div className="rounded-md border border-border bg-surface px-4 py-4 text-sm text-muted-foreground">
              Aucune activité inhabituelle détectée.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {anomalies.map((a, i) => (
                <div
                  key={`${a.kind}-${i}`}
                  className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-4 py-3"
                >
                  <Icon i="alert-triangle" size={14} className="text-warning shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground">{a.detail}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Activité récente</h2>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-md border border-border bg-input px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Tous les types</option>
              <option value="LOGIN_SUCCESS">Connexions réussies</option>
              <option value="LOGIN_FAILED">Connexions échouées</option>
              <option value="PASSWORD_CHANGED">Mots de passe changés</option>
            </select>
          </div>
          <div className="rounded-md border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-[170px_1fr_160px_190px] gap-2 px-5 py-2 border-b border-border bg-background">
                  {['Type', 'Compte', 'IP', 'Date'].map((h) => (
                    <div
                      key={h}
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {h}
                    </div>
                  ))}
                </div>
                {eventsLoading && !eventsRes ? (
                  <p className="px-5 py-6 text-sm text-muted-foreground">Chargement…</p>
                ) : (eventsRes?.items.length ?? 0) === 0 ? (
                  <p className="px-5 py-6 text-sm text-muted-foreground">
                    Aucun événement pour ce filtre.
                  </p>
                ) : (
                  eventsRes?.items.map((row) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-[170px_1fr_160px_190px] gap-2 items-center px-5 py-3 border-b border-border last:border-0"
                    >
                      <div>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${EVENT_TYPE_BADGE[row.type]}`}
                        >
                          {EVENT_TYPE_LABELS[row.type]}
                        </span>
                      </div>
                      <div className="text-sm text-foreground truncate">{row.email}</div>
                      <div className="text-sm text-muted-foreground">{row.ip ?? '—'}</div>
                      <div className="text-sm text-muted-foreground">
                        {dateLabel(row.createdAt)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <Link
          href="/admin/audit-log"
          className="flex items-center justify-between rounded-md border border-border bg-surface px-5 py-4 transition duration-150 hover:bg-input"
        >
          <div className="flex items-center gap-3">
            <Icon i="file-text" size={16} className="text-primary" />
            <div>
              <div className="text-sm font-semibold text-foreground">
                Journal d&apos;audit — actions sensibles
              </div>
              <div className="text-xs text-muted-foreground">
                Chaque mutation back-office (suspension, changement de rôle, remboursement…) avec
                qui, quand, et depuis quelle IP.
              </div>
            </div>
          </div>
          <Icon i="arrow-right" size={16} className="text-muted-foreground shrink-0" />
        </Link>
      </div>
    </AdminShell>
  );
}
