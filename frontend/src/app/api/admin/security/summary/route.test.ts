// Admin — Sécurité — aggregate KPI counts. Mirrors email-stats/route.test.ts
// (sequential prisma.securityEvent.count calls + one findMany for the
// distinct-active-accounts approximation + the anomalies count).
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
vi.mock('@/lib/server/security/anomalies', () => ({
  countAnomalies: vi.fn(),
}));

import { requireAdmin } from '@/lib/server/middleware';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { countAnomalies } from '@/lib/server/security/anomalies';
import { GET } from './route';

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockEnforceAdminRateLimit = vi.mocked(enforceAdminRateLimit);
const mockCountAnomalies = vi.mocked(countAnomalies);

const adminCtx = {
  user: { sub: 'admin-1', email: 'admin@test.local' },
  admin: { id: 'admin-1', email: 'admin@test.local', role: 'ADMIN' as const },
};

function makeGet(): NextRequest {
  return new NextRequest('http://test/api/admin/security/summary', { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireAdmin.mockResolvedValue(adminCtx);
  mockEnforceAdminRateLimit.mockResolvedValue(null);
  mockCountAnomalies.mockResolvedValue(0);
});

describe('GET /api/admin/security/summary', () => {
  it('returns windowHours + all 5 KPI counts', async () => {
    prismaMock.securityEvent.count
      .mockResolvedValueOnce(3) // adminLogins24h
      .mockResolvedValueOnce(7) // failedLogins24h
      .mockResolvedValueOnce(2); // passwordChanges24h
    prismaMock.securityEvent.findMany.mockResolvedValueOnce([
      { userId: 'u1' },
      { userId: 'u2' },
    ] as never);
    mockCountAnomalies.mockResolvedValueOnce(1);

    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      windowHours: 24,
      adminLogins24h: 3,
      failedLogins24h: 7,
      passwordChanges24h: 2,
      activeAccounts24h: 2,
      unusualActivityCount: 1,
    });
  });

  it('adminLogins24h filters LOGIN_SUCCESS scoped to ADMIN/SUPERADMIN role', async () => {
    prismaMock.securityEvent.count.mockResolvedValue(0);
    prismaMock.securityEvent.findMany.mockResolvedValue([] as never);
    await GET(makeGet());

    expect(prismaMock.securityEvent.count).toHaveBeenNthCalledWith(1, {
      where: {
        type: 'LOGIN_SUCCESS',
        createdAt: { gte: expect.any(Date) },
        user: { role: { in: ['ADMIN', 'SUPERADMIN'] } },
      },
    });
  });

  it('returns 403 when requireAdmin bails', async () => {
    mockRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(403);
    expect(prismaMock.securityEvent.count).not.toHaveBeenCalled();
  });

  it('returns 429 when the admin rate limit is exceeded', async () => {
    mockEnforceAdminRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 }),
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(429);
    expect(prismaMock.securityEvent.count).not.toHaveBeenCalled();
  });
});
