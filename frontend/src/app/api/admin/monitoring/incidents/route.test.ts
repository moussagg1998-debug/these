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

const adminCtx = {
  user: { sub: 'admin-1', email: 'admin@test.local' },
  admin: { id: 'admin-1', email: 'admin@test.local', role: 'ADMIN' as const },
};

function makeGet(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

function incidentRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'incident-1',
    service: 'neon',
    severity: 'CRITICAL',
    status: 'OPEN',
    detectedError: "Can't reach database server",
    detectedAt: new Date(),
    resolvedAt: null,
    durationMs: null,
    createdAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireAdmin.mockResolvedValue(adminCtx);
  mockEnforceAdminRateLimit.mockResolvedValue(null);
  prismaMock.monitoringIncident.findMany.mockResolvedValue([]);
});

describe('GET /api/admin/monitoring/incidents', () => {
  it('401/403s when requireAdmin bails', async () => {
    mockRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );
    const res = await GET(makeGet('http://test/api/admin/monitoring/incidents'));
    expect(res.status).toBe(403);
    expect(prismaMock.monitoringIncident.findMany).not.toHaveBeenCalled();
  });

  it('orders by createdAt desc, id desc (cursor pagination)', async () => {
    prismaMock.monitoringIncident.findMany.mockResolvedValue([incidentRow()] as never);
    await GET(makeGet('http://test/api/admin/monitoring/incidents'));
    const args = prismaMock.monitoringIncident.findMany.mock.calls[0]?.[0];
    expect(args?.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('filters by a valid ?service=', async () => {
    prismaMock.monitoringIncident.findMany.mockResolvedValue([] as never);
    await GET(makeGet('http://test/api/admin/monitoring/incidents?service=neon'));
    const args = prismaMock.monitoringIncident.findMany.mock.calls[0]?.[0];
    expect(args?.where?.service).toBe('neon');
  });

  it('ignores an unknown ?service= value rather than erroring', async () => {
    prismaMock.monitoringIncident.findMany.mockResolvedValue([] as never);
    await GET(makeGet('http://test/api/admin/monitoring/incidents?service=not-a-real-service'));
    const args = prismaMock.monitoringIncident.findMany.mock.calls[0]?.[0];
    expect(args?.where?.service).toBeUndefined();
  });

  it('filters by ?status=OPEN or RESOLVED', async () => {
    prismaMock.monitoringIncident.findMany.mockResolvedValue([] as never);
    await GET(makeGet('http://test/api/admin/monitoring/incidents?status=OPEN'));
    const args = prismaMock.monitoringIncident.findMany.mock.calls[0]?.[0];
    expect(args?.where?.status).toBe('OPEN');
  });

  it('filters by ?status=ACKNOWLEDGED ("en cours", Centre d\'alertes)', async () => {
    prismaMock.monitoringIncident.findMany.mockResolvedValue([] as never);
    await GET(makeGet('http://test/api/admin/monitoring/incidents?status=ACKNOWLEDGED'));
    const args = prismaMock.monitoringIncident.findMany.mock.calls[0]?.[0];
    expect(args?.where?.status).toBe('ACKNOWLEDGED');
  });

  it('paginates with a nextCursor when more rows exist than the limit', async () => {
    const rows = Array.from({ length: 11 }, (_, i) => incidentRow({ id: `incident-${i}` }));
    prismaMock.monitoringIncident.findMany.mockResolvedValue(rows as never);

    const res = await GET(makeGet('http://test/api/admin/monitoring/incidents?limit=10'));
    const body = await res.json();
    expect(body.items).toHaveLength(10);
    expect(body.nextCursor).not.toBeNull();
  });
});
