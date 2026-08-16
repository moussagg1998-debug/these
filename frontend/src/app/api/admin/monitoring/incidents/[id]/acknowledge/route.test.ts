// Admin -> Centre d'alertes — PATCH .../acknowledge ("Prendre en charge").
// Mirrors users/[id]/reset-password/route.test.ts's mocking shape (same
// requireAdmin/verifyCsrf/rate-limit/logAdminAction/$transaction pattern).
import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/server/middleware', () => ({
  requireAdmin: vi.fn(),
}));
vi.mock('@/lib/server/middleware/rate-limit-by-userid', () => ({
  enforceAdminRateLimit: vi.fn(),
}));
vi.mock('@/lib/server/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/auth')>('@/lib/server/auth');
  return {
    ...actual,
    verifyCsrf: vi.fn(),
  };
});
vi.mock('@/lib/server/admin/audit', () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined),
}));

import { requireAdmin } from '@/lib/server/middleware';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { verifyCsrf } from '@/lib/server/auth';
import { logAdminAction } from '@/lib/server/admin/audit';
import { PATCH } from './route';
import { seedAdmin } from '@/test-utils/admin-fixtures';

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockRateLimit = vi.mocked(enforceAdminRateLimit);
const mockVerifyCsrf = vi.mocked(verifyCsrf);
const mockLogAdminAction = vi.mocked(logAdminAction);

const adminUser = seedAdmin({ id: 'admin_1', email: 'admin@test.local' });
const adminCtx = {
  user: { sub: adminUser.id, email: adminUser.email },
  admin: { id: adminUser.id, email: adminUser.email, role: 'ADMIN' as const },
};

function makePatch(url: string): NextRequest {
  return new NextRequest(url, { method: 'PATCH' });
}

function paramsOf(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(adminCtx);
  mockRateLimit.mockResolvedValue(null);
  mockVerifyCsrf.mockReturnValue(null);
  mockLogAdminAction.mockResolvedValue(undefined);
  prismaMock.$transaction.mockImplementation((cb: unknown) => {
    if (typeof cb === 'function') {
      return (cb as (tx: typeof prismaMock) => unknown)(prismaMock) as Promise<unknown>;
    }
    return Promise.resolve(cb);
  });
});

describe('PATCH /api/admin/monitoring/incidents/[id]/acknowledge', () => {
  it('happy path: OPEN -> ACKNOWLEDGED, audited', async () => {
    prismaMock.monitoringIncident.findUnique.mockResolvedValueOnce({
      id: 'incident-1',
      status: 'OPEN',
      service: 'resend',
    } as never);
    prismaMock.monitoringIncident.update.mockResolvedValueOnce({
      id: 'incident-1',
      status: 'ACKNOWLEDGED',
    } as never);

    const res = await PATCH(
      makePatch('http://test/api/admin/monitoring/incidents/incident-1/acknowledge'),
      paramsOf('incident-1'),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ incident: { id: 'incident-1', status: 'ACKNOWLEDGED' } });
    expect(prismaMock.monitoringIncident.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'incident-1' },
        data: expect.objectContaining({ status: 'ACKNOWLEDGED' }),
      }),
    );
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: adminUser.id,
        action: 'monitoring.incident_acknowledge',
        targetType: 'MonitoringIncident',
        targetId: 'incident-1',
        metadata: { service: 'resend' },
      }),
    );
  });

  it('is idempotent when already ACKNOWLEDGED: 200, no update, no audit row', async () => {
    prismaMock.monitoringIncident.findUnique.mockResolvedValueOnce({
      id: 'incident-1',
      status: 'ACKNOWLEDGED',
      service: 'resend',
    } as never);

    const res = await PATCH(
      makePatch('http://test/api/admin/monitoring/incidents/incident-1/acknowledge'),
      paramsOf('incident-1'),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ incident: { id: 'incident-1', status: 'ACKNOWLEDGED' } });
    expect(prismaMock.monitoringIncident.update).not.toHaveBeenCalled();
    expect(mockLogAdminAction).not.toHaveBeenCalled();
  });

  it('409s when the incident is already RESOLVED, no update, no audit row', async () => {
    prismaMock.monitoringIncident.findUnique.mockResolvedValueOnce({
      id: 'incident-1',
      status: 'RESOLVED',
      service: 'resend',
    } as never);

    const res = await PATCH(
      makePatch('http://test/api/admin/monitoring/incidents/incident-1/acknowledge'),
      paramsOf('incident-1'),
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('ALREADY_RESOLVED');
    expect(prismaMock.monitoringIncident.update).not.toHaveBeenCalled();
    expect(mockLogAdminAction).not.toHaveBeenCalled();
  });

  it('404s on a missing incident', async () => {
    prismaMock.monitoringIncident.findUnique.mockResolvedValueOnce(null);

    const res = await PATCH(
      makePatch('http://test/api/admin/monitoring/incidents/missing/acknowledge'),
      paramsOf('missing'),
    );

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('INCIDENT_NOT_FOUND');
    expect(mockLogAdminAction).not.toHaveBeenCalled();
  });

  it('rejects when CSRF fails, before touching auth or the DB', async () => {
    mockVerifyCsrf.mockReturnValueOnce(
      NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 }),
    );

    const res = await PATCH(
      makePatch('http://test/api/admin/monitoring/incidents/incident-1/acknowledge'),
      paramsOf('incident-1'),
    );

    expect(res.status).toBe(403);
    expect(mockRequireAdmin).not.toHaveBeenCalled();
    expect(prismaMock.monitoringIncident.findUnique).not.toHaveBeenCalled();
  });

  it('propagates 403 from requireAdmin (non-admin caller)', async () => {
    mockRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );

    const res = await PATCH(
      makePatch('http://test/api/admin/monitoring/incidents/incident-1/acknowledge'),
      paramsOf('incident-1'),
    );

    expect(res.status).toBe(403);
    expect(prismaMock.monitoringIncident.findUnique).not.toHaveBeenCalled();
  });

  it('propagates 429 from the rate limiter without touching the DB', async () => {
    mockRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 }),
    );

    const res = await PATCH(
      makePatch('http://test/api/admin/monitoring/incidents/incident-1/acknowledge'),
      paramsOf('incident-1'),
    );

    expect(res.status).toBe(429);
    expect(prismaMock.monitoringIncident.findUnique).not.toHaveBeenCalled();
  });
});
