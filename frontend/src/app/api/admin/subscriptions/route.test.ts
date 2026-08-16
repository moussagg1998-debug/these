// GET /api/admin/subscriptions — subscriber list for Admin → Abonnements.
// Always filtered to plan='ESSENTIEL'; take:200, no cursor (see route.ts's
// header comment for why the generic cursor helper doesn't fit here).
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  prismaMock.user.findMany.mockResolvedValue([]);
});

describe('/api/admin/subscriptions', () => {
  it('GET always filters to plan=ESSENTIEL, ordered by planExpiresAt asc with nulls last, take 200', async () => {
    await GET(makeGet('http://test/api/admin/subscriptions'));
    const args = prismaMock.user.findMany.mock.calls[0]?.[0];
    expect(args?.where).toEqual({ plan: 'ESSENTIEL' });
    expect(args?.orderBy).toEqual([
      { planExpiresAt: { sort: 'asc', nulls: 'last' } },
      { id: 'asc' },
    ]);
    expect(args?.take).toBe(200);
  });

  it('GET applies the q search on name/email alongside the plan filter', async () => {
    await GET(makeGet('http://test/api/admin/subscriptions?q=amadou'));
    const args = prismaMock.user.findMany.mock.calls[0]?.[0];
    expect(args?.where).toEqual({
      plan: 'ESSENTIEL',
      OR: [
        { email: { contains: 'amadou', mode: 'insensitive' } },
        { name: { contains: 'amadou', mode: 'insensitive' } },
      ],
    });
  });

  it('GET returns { items }, no nextCursor', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: 'user-1',
        email: 'amadou@example.com',
        name: 'Amadou Diallo',
        avatarUrl: null,
        plan: 'ESSENTIEL',
        planExpiresAt: new Date('2026-09-01T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ] as never);
    const res = await GET(makeGet('http://test/api/admin/subscriptions'));
    const body = await res.json();
    expect(body).toEqual({
      items: [
        {
          id: 'user-1',
          email: 'amadou@example.com',
          name: 'Amadou Diallo',
          avatarUrl: null,
          plan: 'ESSENTIEL',
          planExpiresAt: '2026-09-01T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    expect(body).not.toHaveProperty('nextCursor');
  });

  it('GET returns 403 when requireAdmin bails', async () => {
    mockRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );
    const res = await GET(makeGet('http://test/api/admin/subscriptions'));
    expect(res.status).toBe(403);
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it('GET short-circuits when admin rate limit is exceeded', async () => {
    mockEnforceAdminRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 }),
    );
    const res = await GET(makeGet('http://test/api/admin/subscriptions'));
    expect(res.status).toBe(429);
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });
});
