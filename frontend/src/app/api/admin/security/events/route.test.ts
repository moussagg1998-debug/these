// Admin — Sécurité — GET /api/admin/security/events. Mirrors
// audit-log/route.test.ts's filter/pagination coverage.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies } from '@/test-utils/mock-cookies';
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
const mockEnforceRateLimit = vi.mocked(enforceAdminRateLimit);

const adminCtx = {
  user: { sub: 'admin-1', email: 'admin@test.local' },
  admin: { id: 'admin-1', email: 'admin@test.local', role: 'ADMIN' as const },
};

function makeGet(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(adminCtx);
  mockEnforceRateLimit.mockResolvedValue(null);
  prismaMock.securityEvent.findMany.mockResolvedValue([]);
});

describe('GET /api/admin/security/events', () => {
  it('401/403s when requireAdmin bails', async () => {
    mockRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );
    const res = await GET(makeGet('http://test/api/admin/security/events'));
    expect(res.status).toBe(403);
    expect(prismaMock.securityEvent.findMany).not.toHaveBeenCalled();
  });

  it('429s when the rate limit fires', async () => {
    mockEnforceRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 }),
    );
    const res = await GET(makeGet('http://test/api/admin/security/events'));
    expect(res.status).toBe(429);
    expect(prismaMock.securityEvent.findMany).not.toHaveBeenCalled();
  });

  it('orders by createdAt desc, id desc + take limit+1', async () => {
    await GET(makeGet('http://test/api/admin/security/events?limit=20'));
    const args = prismaMock.securityEvent.findMany.mock.calls[0]?.[0];
    expect(args?.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    expect(args?.take).toBe(21);
  });

  it('filters by a valid ?type=', async () => {
    await GET(makeGet('http://test/api/admin/security/events?type=LOGIN_FAILED'));
    const args = prismaMock.securityEvent.findMany.mock.calls[0]?.[0];
    expect(args?.where?.type).toBe('LOGIN_FAILED');
  });

  it('ignores an unknown ?type= value rather than erroring', async () => {
    await GET(makeGet('http://test/api/admin/security/events?type=NOT_A_TYPE'));
    const args = prismaMock.securityEvent.findMany.mock.calls[0]?.[0];
    expect(args?.where?.type).toBeUndefined();
  });

  it('filters by ?email, lowercased and trimmed', async () => {
    await GET(makeGet('http://test/api/admin/security/events?email=%20User%40Test.Local%20'));
    const args = prismaMock.securityEvent.findMany.mock.calls[0]?.[0];
    expect(args?.where?.email).toBe('user@test.local');
  });

  it('filters by ?since/?until (createdAt gte/lte)', async () => {
    await GET(
      makeGet(
        'http://test/api/admin/security/events?since=2026-08-01T00:00:00Z&until=2026-08-08T00:00:00Z',
      ),
    );
    const args = prismaMock.securityEvent.findMany.mock.calls[0]?.[0];
    const createdAt = args?.where?.createdAt as { gte?: Date; lte?: Date } | undefined;
    expect(createdAt?.gte?.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(createdAt?.lte?.toISOString()).toBe('2026-08-08T00:00:00.000Z');
  });

  it('selects the full row shape (id, type, userId, email, ip, userAgent, metadata, createdAt)', async () => {
    await GET(makeGet('http://test/api/admin/security/events'));
    const args = prismaMock.securityEvent.findMany.mock.calls[0]?.[0];
    expect(args?.select).toEqual({
      id: true,
      type: true,
      userId: true,
      email: true,
      ip: true,
      userAgent: true,
      metadata: true,
      createdAt: true,
    });
  });

  it('paginates with a nextCursor when more rows exist than the limit', async () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({
      id: `se-${i}`,
      type: 'LOGIN_FAILED',
      userId: null,
      email: 'a@b.com',
      ip: null,
      userAgent: null,
      metadata: null,
      createdAt: new Date(`2026-08-${String(11 - i).padStart(2, '0')}T00:00:00Z`),
    }));
    prismaMock.securityEvent.findMany.mockResolvedValue(rows as never);

    const res = await GET(makeGet('http://test/api/admin/security/events?limit=10'));
    const body = await res.json();
    expect(body.items).toHaveLength(10);
    expect(body.nextCursor).not.toBeNull();
  });
});
