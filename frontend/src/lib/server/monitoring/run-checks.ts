// Admin monitoring center — orchestrator + threshold/incident state machine.
//
// Called by POST /api/cron/monitoring-check (every 2 min) and the
// SUPERADMIN-only "Vérifier maintenant" trigger
// (POST /api/admin/monitoring/check-now). Runs the 8 checks SEQUENTIALLY —
// DATABASE_URL pins connection_limit=1 for Neon serverless (same rationale
// documented in frontend/src/app/api/theses/route.ts) — and is wrapped in a
// Redis leader-lease so an overlapping cron tick can't double-count
// consecutive failures.
//
// State machine (matches the spec's example exactly):
//   - `unverified` result (missing optional-provider creds) → status
//     UNVERIFIED, never touches consecutiveFailures, never opens an
//     incident. Never fabricated.
//   - success → status OPERATIONAL, consecutiveFailures reset to 0. If the
//     service was CRITICAL or WARNING, the open-or-acknowledged
//     MonitoringIncident is resolved with a computed durationMs.
//   - failure → consecutiveFailures += 1, banded into OPERATIONAL (still
//     below MONITORING_WARNING_THRESHOLD — avoids flagging on a single
//     transient blip) / WARNING or CRITICAL (both open-or-update a
//     MonitoringIncident row — Admin → Centre d'alertes reads this table;
//     WARNING-level incidents feed alerts like "taux d'échec des emails
//     élevé" that were never persisted before this severity was wired up).
import 'server-only';
import { prisma } from '@/lib/server/prisma';
import { redis } from '@/lib/server/redis';
import { withLease } from '@/lib/server/leader-lease';
import { createLogger } from '@/lib/server/logger';
import { sanitizeCheckError } from './sanitize';
import type { Checker, CheckResult, ServiceKey, ServiceStatus } from './types';
import { checkApplication } from './checks/application';
import { checkNeon } from './checks/neon';
import { checkVercel } from './checks/vercel';
import { checkGithub } from './checks/github';
import { checkCloudinary } from './checks/cloudinary';
import { checkResend } from './checks/resend';
import { checkUpstash } from './checks/upstash';
import { checkBictorys } from './checks/bictorys';

const log = createLogger();

const CHECKERS: Checker[] = [
  { service: 'application', run: checkApplication },
  { service: 'neon', run: checkNeon },
  { service: 'vercel', run: checkVercel },
  { service: 'github', run: checkGithub },
  { service: 'cloudinary', run: checkCloudinary },
  { service: 'resend', run: checkResend },
  { service: 'upstash', run: checkUpstash },
  { service: 'bictorys', run: checkBictorys },
];

function positiveIntEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

function warningThreshold(): number {
  return positiveIntEnv('MONITORING_WARNING_THRESHOLD', 1);
}

function criticalThreshold(): number {
  return Math.max(warningThreshold(), positiveIntEnv('MONITORING_CRITICAL_THRESHOLD', 3));
}

export interface MonitoringRunSummary {
  service: ServiceKey;
  status: ServiceStatus;
}

/**
 * Runs all 8 checks and applies the state machine. Exported directly for
 * the SUPERADMIN "check now" route (no lease — a single admin-triggered
 * run doesn't need cross-instance coordination). The cron route uses
 * `runMonitoringChecksLeased` instead.
 */
export async function runMonitoringChecks(): Promise<MonitoringRunSummary[]> {
  const summaries: MonitoringRunSummary[] = [];
  for (const { service, run } of CHECKERS) {
    let result: CheckResult;
    try {
      result = await run();
    } catch (err) {
      // The checker itself throwing (bug, unexpected response shape) is
      // still a real failure signal — never silently skip a service.
      result = {
        ok: false,
        latencyMs: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    const status = await applyCheckResult(service, result);
    summaries.push({ service, status });
  }
  return summaries;
}

/**
 * Leader-lease-guarded variant for the cron route — prevents two
 * overlapping ticks (a slow run still in flight when the next fires) from
 * double-incrementing consecutiveFailures. No-op passthrough (runs
 * unconditionally) when Redis isn't configured, matching `withLease`'s own
 * single-instance-dev fallback.
 */
export async function runMonitoringChecksLeased(): Promise<MonitoringRunSummary[]> {
  let summaries: MonitoringRunSummary[] = [];
  await withLease(redis ?? undefined, 'monitoring-check', 90_000, async () => {
    summaries = await runMonitoringChecks();
  });
  return summaries;
}

/**
 * Applies one check's result to the state machine (upserts
 * MonitoringServiceStatus, opens/resolves MonitoringIncident as needed) and
 * returns the resulting status. Exported directly so tests can drive the
 * state machine per-service without mocking all 8 checker modules through
 * `runMonitoringChecks()`.
 */
export async function applyCheckResult(
  service: ServiceKey,
  result: CheckResult,
): Promise<ServiceStatus> {
  const now = new Date();

  if (result.unverified) {
    await prisma.monitoringServiceStatus.upsert({
      where: { service },
      create: {
        service,
        status: 'UNVERIFIED',
        lastCheckedAt: now,
        lastError: result.error ?? null,
        consecutiveFailures: 0,
      },
      update: {
        status: 'UNVERIFIED',
        lastCheckedAt: now,
        lastLatencyMs: null,
        lastError: result.error ?? null,
        consecutiveFailures: 0,
      },
    });
    return 'UNVERIFIED';
  }

  // Sequential — see file header. One read, then one write per service.
  const prev = await prisma.monitoringServiceStatus.findUnique({ where: { service } });

  if (result.ok) {
    await prisma.monitoringServiceStatus.upsert({
      where: { service },
      create: {
        service,
        status: 'OPERATIONAL',
        lastCheckedAt: now,
        lastSuccessAt: now,
        lastLatencyMs: result.latencyMs,
        lastError: null,
        consecutiveFailures: 0,
      },
      update: {
        status: 'OPERATIONAL',
        lastCheckedAt: now,
        lastSuccessAt: now,
        lastLatencyMs: result.latencyMs,
        lastError: null,
        consecutiveFailures: 0,
      },
    });

    if (prev?.status === 'CRITICAL' || prev?.status === 'WARNING') {
      const openIncident = await prisma.monitoringIncident.findFirst({
        where: { service, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
        orderBy: { detectedAt: 'desc' },
      });
      if (openIncident) {
        const durationMs = now.getTime() - openIncident.detectedAt.getTime();
        await prisma.monitoringIncident.update({
          where: { id: openIncident.id },
          data: { status: 'RESOLVED', resolvedAt: now, durationMs },
        });
        log.info('monitoring: incident resolved', {
          service,
          incidentId: openIncident.id,
          durationMs,
        });
      }
    }

    return 'OPERATIONAL';
  }

  // Failure — band by consecutive count, never fabricate a Critical
  // incident off a single blip.
  const consecutiveFailures = (prev?.consecutiveFailures ?? 0) + 1;
  const critical = criticalThreshold();
  const warning = warningThreshold();
  const newStatus: ServiceStatus =
    consecutiveFailures >= critical
      ? 'CRITICAL'
      : consecutiveFailures >= warning
        ? 'WARNING'
        : 'OPERATIONAL';
  const sanitizedError = sanitizeCheckError(result.error ?? 'Unknown error');

  await prisma.monitoringServiceStatus.upsert({
    where: { service },
    create: {
      service,
      status: newStatus,
      lastCheckedAt: now,
      lastLatencyMs: result.latencyMs,
      lastError: sanitizedError,
      consecutiveFailures,
    },
    update: {
      status: newStatus,
      lastCheckedAt: now,
      lastLatencyMs: result.latencyMs,
      lastError: sanitizedError,
      consecutiveFailures,
    },
  });

  if (newStatus === 'CRITICAL' || newStatus === 'WARNING') {
    // One open-or-acknowledged incident per service at a time — a WARNING
    // that escalates to CRITICAL (or vice versa, though consecutiveFailures
    // never decreases while still failing, so only escalation happens in
    // practice) updates the SAME row's severity rather than opening a
    // second one for the same ongoing issue.
    const existingOpen = await prisma.monitoringIncident.findFirst({
      where: { service, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
      orderBy: { detectedAt: 'desc' },
    });
    if (existingOpen) {
      await prisma.monitoringIncident.update({
        where: { id: existingOpen.id },
        data: { detectedError: sanitizedError, severity: newStatus },
      });
    } else {
      const created = await prisma.monitoringIncident.create({
        data: {
          service,
          severity: newStatus,
          status: 'OPEN',
          detectedError: sanitizedError,
          detectedAt: now,
        },
      });
      log.warn('monitoring: incident opened', {
        service,
        incidentId: created.id,
        severity: newStatus,
        error: sanitizedError,
      });
    }
  }

  return newStatus;
}
