// Admin — Centre d'alertes. Every MonitoringIncident (CRITICAL + WARNING)
// in one triage inbox: priorité / date / service / statut
// (nouvelle/en cours/résolue) + "Prendre en charge" / "Marquer comme
// traitée" actions. Sourced from the same GET /api/admin/monitoring/incidents
// the /admin/monitoring history table uses — this page is the dedicated
// triage view, that one stays a read-only health-center summary.
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { api, ApiError } from '@/lib/api';
import { useApi, invalidateCachePrefix } from '@/lib/useApi';
import { Icon } from '@/components/ui/Icon';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  SERVICE_KEYS,
  SERVICE_LABELS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_BADGE,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_SEVERITY_ICON,
  formatTime,
  humanizeDuration,
  type ServiceKey,
  type IncidentStatus,
  type IncidentSeverity,
} from '@/lib/monitoring';

interface AdminMeResponse {
  admin: { id: string; email: string; role: 'ADMIN' | 'SUPERADMIN' };
  can: string[];
}

interface AlertRow {
  id: string;
  service: ServiceKey;
  severity: IncidentSeverity;
  status: IncidentStatus;
  detectedError: string;
  detectedAt: string;
  resolvedAt: string | null;
  durationMs: number | null;
}

interface AlertsResponse {
  items: AlertRow[];
  nextCursor: string | null;
}

function dateLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR')} à ${formatTime(iso)}`;
}

export default function AdminAlertsPage() {
  const user = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [service, setService] = useState('');
  const [status, setStatus] = useState('');
  const [extraItems, setExtraItems] = useState<AlertRow[]>([]);
  const [extraCursor, setExtraCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<AlertRow | null>(null);

  const { data: me, error: meError } = useApi<AdminMeResponse>('/api/admin/me', { skip: !user });

  const apiPath = useMemo(() => {
    const params = new URLSearchParams();
    if (service) params.set('service', service);
    if (status) params.set('status', status);
    const qs = params.toString();
    return `/api/admin/monitoring/incidents${qs ? `?${qs}` : ''}`;
  }, [service, status]);

  const {
    data: alertsRes,
    loading: alertsLoading,
    refresh: refreshAlerts,
  } = useApi<AlertsResponse>(apiPath, { skip: !me });

  const items = useMemo(
    () => [...(alertsRes?.items ?? []), ...extraItems],
    [alertsRes, extraItems],
  );
  const cursor = extraCursor !== null ? extraCursor : (alertsRes?.nextCursor ?? null);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const sep = apiPath.includes('?') ? '&' : '?';
      const page = await api<AlertsResponse>(
        `${apiPath}${sep}cursor=${encodeURIComponent(cursor)}`,
      );
      setExtraItems((prev) => [...prev, ...page.items]);
      setExtraCursor(page.nextCursor);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Une erreur est survenue', 'error');
    } finally {
      setLoadingMore(false);
    }
  }

  function refetch() {
    setExtraItems([]);
    setExtraCursor(null);
    invalidateCachePrefix('/api/admin/monitoring/incidents');
    void refreshAlerts();
  }

  async function acknowledge(row: AlertRow) {
    setBusyId(row.id);
    try {
      await api(`/api/admin/monitoring/incidents/${row.id}/acknowledge`, { method: 'PATCH' });
      toast('Alerte prise en charge.', 'success');
      refetch();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Une erreur est survenue', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function resolve(row: AlertRow) {
    setBusyId(row.id);
    try {
      await api(`/api/admin/monitoring/incidents/${row.id}/resolve`, { method: 'PATCH' });
      toast('Alerte marquée comme traitée.', 'success');
      setResolveTarget(null);
      refetch();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Une erreur est survenue', 'error');
    } finally {
      setBusyId(null);
    }
  }

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

  const canAcknowledge = me.can.includes('alerts:acknowledge');
  const canResolve = me.can.includes('alerts:resolve');

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
            Centre d&apos;alertes
          </h1>
        </div>
      }
    >
      <div className="flex-1 flex flex-col gap-4 px-4 py-6 sm:px-8">
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={service}
            onChange={(e) => setService(e.target.value)}
            className="rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">Tous les services</option>
            {SERVICE_KEYS.map((key) => (
              <option key={key} value={key}>
                {SERVICE_LABELS[key]}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">Tous les statuts</option>
            <option value="OPEN">Nouvelle</option>
            <option value="ACKNOWLEDGED">En cours</option>
            <option value="RESOLVED">Résolue</option>
          </select>
        </div>

        <div className="rounded-md border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[820px]">
              <div className="grid grid-cols-[110px_140px_1.6fr_130px_170px_190px] gap-2 px-5 py-2 border-b border-border bg-background">
                {['Priorité', 'Service', 'Détail', 'Statut', 'Détectée le', ''].map((h) => (
                  <div
                    key={h}
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </div>
                ))}
              </div>

              {alertsLoading && items.length === 0 ? (
                [0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[110px_140px_1.6fr_130px_170px_190px] gap-2 items-center px-5 py-3 border-b border-border last:border-0"
                  >
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-10" />
                  </div>
                ))
              ) : items.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground motion-safe:animate-fade-in">
                  Aucune alerte ne correspond à cette recherche.
                </p>
              ) : (
                items.map((row) => {
                  const critical = row.severity === 'CRITICAL';
                  const resolved = row.status === 'RESOLVED';
                  return (
                    <div
                      key={row.id}
                      className="grid grid-cols-[110px_140px_1.6fr_130px_170px_190px] gap-2 items-center px-5 py-3 border-b border-border last:border-0"
                    >
                      <div>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            critical ? 'bg-danger/15 text-danger' : 'bg-warning/15 text-warning'
                          }`}
                        >
                          <Icon i={INCIDENT_SEVERITY_ICON[row.severity]} size={11} />
                          {INCIDENT_SEVERITY_LABELS[row.severity]}
                        </span>
                      </div>
                      <div className="text-sm text-foreground truncate">
                        {SERVICE_LABELS[row.service]}
                      </div>
                      <div className="text-sm text-muted-foreground line-clamp-1 pr-2">
                        {row.detectedError}
                      </div>
                      <div>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${INCIDENT_STATUS_BADGE[row.status]}`}
                        >
                          {INCIDENT_STATUS_LABELS[row.status]}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {dateLabel(row.detectedAt)}
                        {resolved && row.durationMs != null && (
                          <div className="text-xs">Durée : {humanizeDuration(row.durationMs)}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {row.status === 'OPEN' && canAcknowledge && (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => void acknowledge(row)}
                            className="text-xs font-medium text-primary transition duration-150 hover:opacity-80 disabled:opacity-50"
                          >
                            Prendre en charge
                          </button>
                        )}
                        {!resolved && canResolve && (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => setResolveTarget(row)}
                            className="text-xs font-medium text-success transition duration-150 hover:opacity-80 disabled:opacity-50"
                          >
                            Marquer comme traitée
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {cursor && (
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="self-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50 transition duration-150 hover:bg-input"
          >
            {loadingMore ? 'Chargement…' : 'Charger plus'}
          </button>
        )}
      </div>

      {resolveTarget && (
        <ConfirmModal
          title="Marquer cette alerte comme traitée ?"
          description={`${SERVICE_LABELS[resolveTarget.service]} — ${resolveTarget.detectedError}`}
          confirmLabel="Marquer comme traitée"
          confirmBusyLabel="Un instant…"
          tone="primary"
          busy={busyId === resolveTarget.id}
          onConfirm={() => void resolve(resolveTarget)}
          onCancel={() => setResolveTarget(null)}
        />
      )}
    </AdminShell>
  );
}
