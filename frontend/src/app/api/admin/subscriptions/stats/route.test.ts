// GET /api/admin/subscriptions/stats — KPI row for Admin → Abonnements.
// Mirrors GET /api/admin/stats's test structure exactly.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { seedAdmin } from '@/test-utils/admin-fixtures';

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

const admin = seedAdmin({ id: 'admin-1', email: 'admin@test.local' });
const adminCtx = {
  user: { sub: admin.id, email: admin.email },
  admin: { id: admin.id, email: admin.email, role: 'ADMIN' as const },
};

function makeGet(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireAdmin.mockResolvedValue(adminCtx);
  mockEnforceAdminRateLimit.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('/api/admin/subscriptions/stats', () => {
  it('GET returns the active/stale-expired/free split and the MRR estimate', async () => {
    prismaMock.user.count
      .mockResolvedValueOnce(42) // essentielActive
      .mockResolvedValueOnce(3) // essentielExpiredUnswept
      .mockResolvedValueOnce(318); // free

    const res = await GET(makeGet('http://test/api/admin/subscriptions/stats'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      essentielActive: 42,
      essentielExpiredUnswept: 3,
      free: 318,
      mrrFcfa: 42 * 5900,
    });
  });

  it('counts active as planExpiresAt null-or-future, stale as past, free as plan != ESSENTIEL', async () => {
    prismaMock.user.count.mockResolvedValue(0);
    await GET(makeGet('http://test/api/admin/subscriptions/stats'));

    const activeArgs = prismaMock.user.count.mock.calls[0]?.[0];
    expect(activeArgs?.where).toEqual({
      plan: 'ESSENTIEL',
      OR: [{ planExpiresAt: null }, { planExpiresAt: { gt: expect.any(Date) } }],
    });

    const staleArgs = prismaMock.user.count.mock.calls[1]?.[0];
    expect(staleArgs?.where).toEqual({
      plan: 'ESSENTIEL',
      planExpiresAt: { lte: expect.any(Date) },
    });

    const freeArgs = prismaMock.user.count.mock.calls[2]?.[0];
    expect(freeArgs?.where).toEqual({ plan: { not: 'ESSENTIEL' } });
  });

  it('mrrFcfa respects a CHARIOW_ESSENTIEL_PRICE_FCFA override', async () => {
    vi.stubEnv('CHARIOW_ESSENTIEL_PRICE_FCFA', '9900');
    prismaMock.user.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    const res = await GET(makeGet('http://test/api/admin/subscriptions/stats'));
    const body = await res.json();
    expect(body.mrrFcfa).toBe(99000);
  });

  it('GET returns 403 when requireAdmin bails', async () => {
    mockRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );
    const res = await GET(makeGet('http://test/api/admin/subscriptions/stats'));
    expect(res.status).toBe(403);
    expect(prismaMock.user.count).not.toHaveBeenCalled();
  });

  it('GET short-circuits when admin rate limit is exceeded', async () => {
    mockEnforceAdminRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 }),
    );
    const res = await GET(makeGet('http://test/api/admin/subscriptions/stats'));
    expect(res.status).toBe(429);
    expect(prismaMock.user.count).not.toHaveBeenCalled();
  });
});
