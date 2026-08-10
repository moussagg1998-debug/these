// Tests for the Admin → Monitoring threshold/incident state machine
// (applyCheckResult). Drives the state machine directly per-service rather
// than through runMonitoringChecks() so each scenario doesn't need to mock
// all 8 checker modules.
import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { applyCheckResult } from './run-checks';

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function statusRow(overrides: Partial<{ status: string; consecutiveFailures: number }> = {}) {
  return {
    service: 'neon',
    status: overrides.status ?? 'OPERATIONAL',
    lastCheckedAt: new Date(),
    lastSuccessAt: new Date(),
    lastLatencyMs: 10,
    lastError: null,
    consecutiveFailures: overrides.consecutiveFailures ?? 0,
    updatedAt: new Date(),
  };
}

describe('applyCheckResult — unverified (never fabricates)', () => {
  it('sets status UNVERIFIED, resets consecutiveFailures, never touches incidents', async () => {
    const status = await applyCheckResult('github', {
      ok: false,
      unverified: true,
      latencyMs: 0,
      error: 'GITHUB_TOKEN not configured',
    });

    expect(status).toBe('UNVERIFIED');
    const upsertArg = prismaMock.monitoringServiceStatus.upsert.mock.calls[0]?.[0];
    expect(upsertArg?.update).toMatchObject({ status: 'UNVERIFIED', consecutiveFailures: 0 });
    expect(prismaMock.monitoringIncident.create).not.toHaveBeenCalled();
    expect(prismaMock.monitoringIncident.update).not.toHaveBeenCalled();
    expect(prismaMock.monitoringIncident.findFirst).not.toHaveBeenCalled();
  });
});

describe('applyCheckResult — success', () => {
  it('sets OPERATIONAL and resets consecutiveFailures to 0 (fresh service, no prior row)', async () => {
    prismaMock.monitoringServiceStatus.findUnique.mockResolvedValue(null);

    const status = await applyCheckResult('neon', { ok: true, latencyMs: 15 });

    expect(status).toBe('OPERATIONAL');
    const upsertArg = prismaMock.monitoringServiceStatus.upsert.mock.calls[0]?.[0];
    expect(upsertArg?.update).toMatchObject({
      status: 'OPERATIONAL',
      lastLatencyMs: 15,
      lastError: null,
      consecutiveFailures: 0,
    });
  });

  it('does not look up incidents when the service was already OPERATIONAL', async () => {
    prismaMock.monitoringServiceStatus.findUnique.mockResolvedValue(
      statusRow({ status: 'OPERATIONAL', consecutiveFailures: 0 }) as never,
    );

    await applyCheckResult('neon', { ok: true, latencyMs: 15 });

    expect(prismaMock.monitoringIncident.findFirst).not.toHaveBeenCalled();
  });

  it('resolves the open-or-acknowledged incident with a computed duration when recovering from WARNING', async () => {
    const detectedAt = new Date(Date.now() - 4 * 60_000); // 4 minutes ago
    prismaMock.monitoringServiceStatus.findUnique.mockResolvedValue(
      statusRow({ status: 'WARNING', consecutiveFailures: 1 }) as never,
    );
    prismaMock.monitoringIncident.findFirst.mockResolvedValue({
      id: 'incident-warn-1',
      service: 'resend',
      severity: 'WARNING',
      status: 'ACKNOWLEDGED',
      detectedError: '3 email send failures in the last hour',
      detectedAt,
      resolvedAt: null,
      durationMs: null,
      createdAt: detectedAt,
    } as never);

    const status = await applyCheckResult('resend', { ok: true, latencyMs: 20 });

    expect(status).toBe('OPERATIONAL');
    const findFirstArg = prismaMock.monitoringIncident.findFirst.mock.calls[0]?.[0];
    expect(findFirstArg?.where).toMatchObject({ status: { in: ['OPEN', 'ACKNOWLEDGED'] } });
    const updateArg = prismaMock.monitoringIncident.update.mock.calls[0]?.[0];
    expect(updateArg?.where).toEqual({ id: 'incident-warn-1' });
    expect(updateArg?.data).toMatchObject({ status: 'RESOLVED' });
  });

  it('resolves the open incident with a computed duration when recovering from CRITICAL', async () => {
    const detectedAt = new Date(Date.now() - 7 * 60_000); // 7 minutes ago
    prismaMock.monitoringServiceStatus.findUnique.mockResolvedValue(
      statusRow({ status: 'CRITICAL', consecutiveFailures: 5 }) as never,
    );
    prismaMock.monitoringIncident.findFirst.mockResolvedValue({
      id: 'incident-1',
      service: 'neon',
      severity: 'CRITICAL',
      status: 'OPEN',
      detectedError: "Can't reach database server",
      detectedAt,
      resolvedAt: null,
      durationMs: null,
      createdAt: detectedAt,
    } as never);

    const status = await applyCheckResult('neon', { ok: true, latencyMs: 12 });

    expect(status).toBe('OPERATIONAL');
    const updateArg = prismaMock.monitoringIncident.update.mock.calls[0]?.[0];
    expect(updateArg?.where).toEqual({ id: 'incident-1' });
    expect(updateArg?.data).toMatchObject({ status: 'RESOLVED' });
    const durationMs = (updateArg?.data as { durationMs?: number })?.durationMs;
    expect(durationMs).toBeGreaterThanOrEqual(6.9 * 60_000);
    expect(durationMs).toBeLessThanOrEqual(7.1 * 60_000);
  });
});

describe('applyCheckResult — failure thresholds (anti-false-positive)', () => {
  it("a single failure (default threshold=1) turns the card WARNING and opens a WARNING-severity incident (Admin -> Centre d'alertes)", async () => {
    prismaMock.monitoringServiceStatus.findUnique.mockResolvedValue(null);
    prismaMock.monitoringIncident.findFirst.mockResolvedValue(null);
    prismaMock.monitoringIncident.create.mockResolvedValue({ id: 'incident-warn-new' } as never);

    const status = await applyCheckResult('resend', {
      ok: false,
      latencyMs: 30,
      error: 'HTTP 500',
    });

    expect(status).toBe('WARNING');
    const createArg = prismaMock.monitoringIncident.create.mock.calls[0]?.[0];
    expect(createArg?.data).toMatchObject({
      service: 'resend',
      severity: 'WARNING',
      status: 'OPEN',
      detectedError: 'HTTP 500',
    });
  });

  it('stays OPERATIONAL below a configured MONITORING_WARNING_THRESHOLD, no incident touched', async () => {
    vi.stubEnv('MONITORING_WARNING_THRESHOLD', '2');
    prismaMock.monitoringServiceStatus.findUnique.mockResolvedValue(null); // 0 prior failures

    const status = await applyCheckResult('resend', {
      ok: false,
      latencyMs: 30,
      error: 'HTTP 500',
    });

    expect(status).toBe('OPERATIONAL');
    expect(prismaMock.monitoringIncident.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.monitoringIncident.create).not.toHaveBeenCalled();
  });

  it("a WARNING incident that escalates to CRITICAL updates the SAME row's severity instead of opening a second one", async () => {
    prismaMock.monitoringServiceStatus.findUnique.mockResolvedValue(
      statusRow({ status: 'WARNING', consecutiveFailures: 2 }) as never,
    );
    prismaMock.monitoringIncident.findFirst.mockResolvedValue({
      id: 'incident-escalate',
      severity: 'WARNING',
      status: 'ACKNOWLEDGED',
    } as never);

    const status = await applyCheckResult('neon', {
      ok: false,
      latencyMs: 5000,
      error: "Can't reach database server",
    });

    expect(status).toBe('CRITICAL');
    expect(prismaMock.monitoringIncident.create).not.toHaveBeenCalled();
    const updateArg = prismaMock.monitoringIncident.update.mock.calls[0]?.[0];
    expect(updateArg?.where).toEqual({ id: 'incident-escalate' });
    expect(updateArg?.data).toMatchObject({ severity: 'CRITICAL' });
  });

  it('reaching the critical threshold (default 3) opens a CRITICAL incident', async () => {
    prismaMock.monitoringServiceStatus.findUnique.mockResolvedValue(
      statusRow({ status: 'WARNING', consecutiveFailures: 2 }) as never,
    );
    prismaMock.monitoringIncident.findFirst.mockResolvedValue(null);
    prismaMock.monitoringIncident.create.mockResolvedValue({ id: 'incident-2' } as never);

    const status = await applyCheckResult('neon', {
      ok: false,
      latencyMs: 5000,
      error: "Can't reach database server",
    });

    expect(status).toBe('CRITICAL');
    const createArg = prismaMock.monitoringIncident.create.mock.calls[0]?.[0];
    expect(createArg?.data).toMatchObject({
      service: 'neon',
      status: 'OPEN',
      detectedError: "Can't reach database server",
    });
  });

  it('a subsequent failure while already CRITICAL updates the existing open incident instead of creating a second one', async () => {
    prismaMock.monitoringServiceStatus.findUnique.mockResolvedValue(
      statusRow({ status: 'CRITICAL', consecutiveFailures: 4 }) as never,
    );
    prismaMock.monitoringIncident.findFirst.mockResolvedValue({ id: 'incident-3' } as never);

    const status = await applyCheckResult('neon', {
      ok: false,
      latencyMs: 5000,
      error: 'connection timeout',
    });

    expect(status).toBe('CRITICAL');
    expect(prismaMock.monitoringIncident.create).not.toHaveBeenCalled();
    const updateArg = prismaMock.monitoringIncident.update.mock.calls[0]?.[0];
    expect(updateArg?.where).toEqual({ id: 'incident-3' });
    expect(updateArg?.data).toMatchObject({ detectedError: 'connection timeout' });
  });

  it('honors a configured MONITORING_CRITICAL_THRESHOLD (still WARNING, updates the existing WARNING incident rather than escalating)', async () => {
    vi.stubEnv('MONITORING_CRITICAL_THRESHOLD', '5');
    prismaMock.monitoringServiceStatus.findUnique.mockResolvedValue(
      statusRow({ status: 'WARNING', consecutiveFailures: 3 }) as never,
    );
    prismaMock.monitoringIncident.findFirst.mockResolvedValue({
      id: 'incident-still-warn',
      severity: 'WARNING',
      status: 'OPEN',
    } as never);

    const status = await applyCheckResult('upstash', {
      ok: false,
      latencyMs: 10,
      error: 'timeout',
    });

    // 4th consecutive failure, still below threshold=5.
    expect(status).toBe('WARNING');
    expect(prismaMock.monitoringIncident.create).not.toHaveBeenCalled();
    const updateArg = prismaMock.monitoringIncident.update.mock.calls[0]?.[0];
    expect(updateArg?.data).toMatchObject({ severity: 'WARNING' });
  });

  it('sanitizes the error before persisting it (never leaks a bearer token)', async () => {
    prismaMock.monitoringServiceStatus.findUnique.mockResolvedValue(null);
    prismaMock.monitoringIncident.findFirst.mockResolvedValue(null);
    prismaMock.monitoringIncident.create.mockResolvedValue({ id: 'incident-sanitized' } as never);

    await applyCheckResult('resend', {
      ok: false,
      latencyMs: 20,
      error: 'Resend API returned HTTP 401 for Bearer re_1234567890abcdef1234567890',
    });

    const upsertArg = prismaMock.monitoringServiceStatus.upsert.mock.calls[0]?.[0];
    const persistedError = (upsertArg?.update as { lastError?: string })?.lastError ?? '';
    expect(persistedError).not.toContain('re_1234567890abcdef1234567890');
    expect(persistedError).toContain('[redacted]');
  });
});
