// Admin — Monitoring — real-time health center for the 8 critical services
// (Application, Neon, Vercel, GitHub, Cloudinary, Resend, Upstash,
// Bictorys). Gated exactly like admin/page.tsx (GET /api/admin/me), same
// role-check every /api/admin/* route already enforces server-side.
//
// Polls GET /api/admin/monitoring/status every 30s — a status dashboard
// doesn't need push/Ably-grade realtime (see CLAUDE.md's realtime
// guidance), and the underlying data only changes once per cron tick (2m)
// anyway.
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useApi } from '@/lib/useApi';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  MonitoringServiceCard,
  MonitoringServiceCardSkeleton,
} from '@/components/admin/MonitoringServiceCard';
import {
  MonitoringIncidentsPanel,
  type IncidentHistoryRow,
  type OpenIncidentView,
} from '@/components/admin/MonitoringIncidentsPanel';
import {
  SERVICE_KEYS,
  type ServiceKey,
  type ServiceStatus,
  type IncidentStatus,
  type IncidentSeverity,
} from '@/lib/monitoring';

const POLL_INTERVAL_MS = 30_000;

interface AdminMeResponse {
  admin: { id: string; email: string; role: 'ADMIN' | 'SUPERADMIN' };
  can: string[];
}

interface ServiceStatusItem {
  service: ServiceKey;
  status: ServiceStatus;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastLatencyMs: number | null;
  lastError: string | null;
  consecutiveFailures: number;
  activeIncidents: number;
}

interface StatusResponse {
  services: ServiceStatusItem[];
  activeIncidentsTotal: number;
}

interface IncidentApiRow {
  id: string;
  service: ServiceKey;
  severity: IncidentSeverity;
  status: IncidentStatus;
  detectedError: string;
  detectedAt: string;
  resolvedAt: string | null;
  durationMs: number | null;
}

interface IncidentsResponse {
  items: IncidentApiRow[];
  nextCursor: string | null;
}

export default function AdminMonitoringPage() {
  const user = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [checkingNow, setCheckingNow] = useState(false);
  const [extraHistory, setExtraHistory] = useState<IncidentApiRow[]>([]);
  const [extraCursor, setExtraCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const { data: me, error: meError } = useApi<AdminMeResponse>('/api/admin/me', { skip: !user });
  const {
    data: status,
    loading: statusLoading,
    refresh: refreshStatus,
  } = useApi<StatusResponse>('/api/admin/monitoring/status', { skip: !me });
  const { data: openIncidentsRes, refresh: refreshOpenIncidents } = useApi<IncidentsResponse>(
    '/api/admin/monitoring/incidents?status=OPEN&limit=8',
    { skip: !me },
  );
  const { data: historyRes, loading: historyLoading } = useApi<IncidentsResponse>(
    '/api/admin/monitoring/incidents',
    { skip: !me },
  );

  // 30s poll — a Monitoring page left open should reflect the next cron
  // tick without a manual refresh.
  useEffect(() => {
    if (!me) return;
    const id = window.setInterval(() => {
      void refreshStatus();
      void refreshOpenIncidents();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [me, refreshStatus, refreshOpenIncidents]);

  const cursor = extraCursor !== null ? extraCursor : (historyRes?.nextCursor ?? null);
  const historyItems = useMemo(
    () => [...(historyRes?.items ?? []), ...extraHistory],
    [historyRes, extraHistory],
  );

  async function loadMoreHistory() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await api<IncidentsResponse>(
        `/api/admin/monitoring/incidents?cursor=${encodeURIComponent(cursor)}`,
      );
      setExtraHistory((prev) => [...prev, ...page.items]);
      setExtraCursor(page.nextCursor);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Une erreur est survenue', 'error');
    } finally {
      setLoadingMore(false);
    }
  }

  async function checkNow() {
    setCheckingNow(true);
    try {
      await api('/api/admin/monitoring/check-now', { method: 'POST' });
      toast('Vérification lancée sur les 8 services.', 'success');
      void refreshStatus();
      void refreshOpenIncidents();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Une erreur est survenue', 'error');
    } finally {
      setCheckingNow(false);
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

  const statusByService = new Map((status?.services ?? []).map((s) => [s.service, s]));

  const openIncidents: OpenIncidentView[] = (openIncidentsRes?.items ?? [])
    .filter((i) => i.status === 'OPEN')
    .map((i) => ({
      id: i.id,
      service: i.service,
      severity: i.severity,
      detectedError: i.detectedError,
      detectedAt: i.detectedAt,
      lastSuccessAt: statusByService.get(i.service)?.lastSuccessAt ?? null,
    }));

  const history: IncidentHistoryRow[] = historyItems.map((i) => ({
    id: i.id,
    service: i.service,
    severity: i.severity,
    status: i.status,
    detectedError: i.detectedError,
    detectedAt: i.detectedAt,
    resolvedAt: i.resolvedAt,
    durationMs: i.durationMs,
  }));

  return (
    <AdminShell
      email={me.admin.email}
      role={me.admin.role}
      header={
        <div className="flex items-center justify-between px-8 py-4 bg-surface border-b border-border gap-4 flex-wrap">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-0.5">
              Administration
            </div>
            <h1 className="text-xl font-semibold font-headings text-foreground">Monitoring</h1>
          </div>
          {me.admin.role === 'SUPERADMIN' && (
            <button
              type="button"
              onClick={() => void checkNow()}
              disabled={checkingNow}
              className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition duration-150 hover:opacity-90 disabled:opacity-50 motion-safe:active:scale-[0.97]"
            >
              <Icon i="activity" size={14} className={checkingNow ? 'animate-spin' : ''} />
              {checkingNow ? 'Vérification…' : 'Vérifier maintenant'}
            </button>
          )}
        </div>
      }
    >
      <div className="flex-1 flex flex-col gap-6 px-4 py-6 sm:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statusLoading && !status
            ? SERVICE_KEYS.map((key) => <MonitoringServiceCardSkeleton key={key} />)
            : SERVICE_KEYS.map((key) => {
                const s = statusByService.get(key);
                return (
                  <MonitoringServiceCard
                    key={key}
                    service={key}
                    status={s?.status ?? 'UNVERIFIED'}
                    lastCheckedAt={s?.lastCheckedAt ?? null}
                    lastLatencyMs={s?.lastLatencyMs ?? null}
                    lastError={s?.lastError ?? null}
                    activeIncidents={s?.activeIncidents ?? 0}
                  />
                );
              })}
        </div>

        <MonitoringIncidentsPanel
          openIncidents={openIncidents}
          history={history}
          historyLoading={(historyLoading && history.length === 0) || loadingMore}
          hasMore={cursor !== null}
          onLoadMore={() => void loadMoreHistory()}
        />
      </div>
    </AdminShell>
  );
}
