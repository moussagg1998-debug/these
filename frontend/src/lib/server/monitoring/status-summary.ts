// Admin monitoring center — shared "current status of all 8 services" query,
// used by both GET /api/admin/monitoring/status and the SUPERADMIN
// POST /api/admin/monitoring/check-now (which returns a fresh summary
// immediately after running the sweep, avoiding a second round-trip).
import 'server-only';
import { prisma } from '@/lib/server/prisma';
import { SERVICE_KEYS, type ServiceKey, type ServiceStatus } from './types';

export interface ServiceStatusSummary {
  service: ServiceKey;
  status: ServiceStatus;
  lastCheckedAt: Date | null;
  lastSuccessAt: Date | null;
  lastLatencyMs: number | null;
  lastError: string | null;
  consecutiveFailures: number;
  activeIncidents: number;
}

export interface StatusSummaryResult {
  services: ServiceStatusSummary[];
  activeIncidentsTotal: number;
}

export async function getStatusSummary(): Promise<StatusSummaryResult> {
  // Sequential — Neon connection_limit=1 (see run-checks.ts's identical note).
  const rows = await prisma.monitoringServiceStatus.findMany({
    where: { service: { in: [...SERVICE_KEYS] } },
  });
  const openCounts = await prisma.monitoringIncident.groupBy({
    by: ['service'],
    where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
    _count: { _all: true },
  });

  // Left-join against the fixed service list so a fresh deploy (before the
  // first cron tick ever runs) still renders all 8 cards as UNVERIFIED
  // rather than an incomplete list.
  const services: ServiceStatusSummary[] = SERVICE_KEYS.map((service) => {
    const row = rows.find((r) => r.service === service);
    const activeIncidents = openCounts.find((c) => c.service === service)?._count._all ?? 0;
    return {
      service,
      status: (row?.status as ServiceStatus | undefined) ?? 'UNVERIFIED',
      lastCheckedAt: row?.lastCheckedAt ?? null,
      lastSuccessAt: row?.lastSuccessAt ?? null,
      lastLatencyMs: row?.lastLatencyMs ?? null,
      lastError: row?.lastError ?? null,
      consecutiveFailures: row?.consecutiveFailures ?? 0,
      activeIncidents,
    };
  });

  const activeIncidentsTotal = services.reduce((sum, s) => sum + s.activeIncidents, 0);
  return { services, activeIncidentsTotal };
}
