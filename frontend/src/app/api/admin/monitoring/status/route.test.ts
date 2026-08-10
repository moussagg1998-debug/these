import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireAdmin: vi.fn(),
}));
vi.mock('@/lib/server/middleware/rate-limit-by-userid', () => ({
  enforceAdminRateLimit: vi.fn(),
}));

import { requireAdmin } from '@/lib/server/middleware';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { GET } from './route';

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockEnforceAdminRateLimit = vi.mocked(enforceAdminRateLimit);

// prisma.monitoringIncident.groupBy's conditional/overloaded generic
// signature defeats vitest-mock-extended's automatic Mock inference —
// cast to the minimal shape this file needs (same workaround as
// admin/institutions/route.test.ts's prisma.user.groupBy).
const mockGroupBy = prismaMock.monitoringIncident.groupBy as unknown as {
  mockResolvedValue: (value: unknown) => void;
};

const adminCtx = {
  user: { sub: 'admin-1', email: 'admin@test.local' },
  admin: { id: 'admin-1', email: 'admin@test.local', role: 'ADMIN' as const },
};

function makeGet(): NextRequest {
  return new NextRequest('http://test/api/admin/monitoring/status', { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireAdmin.mockResolvedValue(adminCtx);
  mockEnforceAdminRateLimit.mockResolvedValue(null);
  prismaMock.monitoringServiceStatus.findMany.mockResolvedValue([]);
  mockGroupBy.mockResolvedValue([]);
});

describe('GET /api/admin/monitoring/status', () => {
  it('401/403s when requireAdmin bails, never queries', async () => {
    mockRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(403);
    expect(prismaMock.monitoringServiceStatus.findMany).not.toHaveBeenCalled();
  });

  it('short-circuits when the admin rate limit is exceeded', async () => {
    mockEnforceAdminRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 }),
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(429);
  });

  it('always returns all 8 services, even with an empty DB (fresh deploy, no cron tick yet)', async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.services).toHaveLength(8);
    expect(body.services.every((s: { status: string }) => s.status === 'UNVERIFIED')).toBe(true);
    expect(body.activeIncidentsTotal).toBe(0);
  });

  it('maps a real status row + open-incident count onto the matching service', async () => {
    prismaMock.monitoringServiceStatus.findMany.mockResolvedValue([
      {
        service: 'neon',
        status: 'CRITICAL',
        lastCheckedAt: new Date('2026-01-01T23:42:00Z'),
        lastSuccessAt: new Date('2026-01-01T23:39:00Z'),
        lastLatencyMs: 5000,
        lastError: "Can't reach database server",
        consecutiveFailures: 3,
        updatedAt: new Date(),
      },
    ] as never);
    mockGroupBy.mockResolvedValue([{ service: 'neon', _count: { _all: 1 } }]);

    const res = await GET(makeGet());
    const body = await res.json();
    const neon = body.services.find((s: { service: string }) => s.service === 'neon');
    expect(neon.status).toBe('CRITICAL');
    expect(neon.activeIncidents).toBe(1);
    expect(body.activeIncidentsTotal).toBe(1);
  });
});
