// PATCH /api/admin/users/[id]/role — no test file existed for this route
// before now. Mirrors the mocking pattern established in
// users/[id]/reset-password/route.test.ts, but SUPERADMIN-only.
import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/server/middleware', () => ({
  requireSuperadmin: vi.fn(),
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

import { requireSuperadmin } from '@/lib/server/middleware';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { verifyCsrf } from '@/lib/server/auth';
import { logAdminAction } from '@/lib/server/admin/audit';
import { PATCH } from './route';

const mockRequireSuperadmin = vi.mocked(requireSuperadmin);
const mockRateLimit = vi.mocked(enforceAdminRateLimit);
const mockVerifyCsrf = vi.mocked(verifyCsrf);
const mockLogAdminAction = vi.mocked(logAdminAction);

const superadminCtx = {
  user: { sub: 'super_1', email: 'super@test.local' },
  admin: { id: 'super_1', email: 'super@test.local', role: 'SUPERADMIN' as const },
};

function makePatch(url: string, body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function paramsOf(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSuperadmin.mockResolvedValue(superadminCtx);
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

describe('PATCH /api/admin/users/[id]/role', () => {
  it('happy path: promotes USER -> ADMIN, audited with ip/userAgent', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: 'u1', role: 'USER' } as never);
    prismaMock.user.update.mockResolvedValueOnce({ id: 'u1', role: 'ADMIN' } as never);

    const res = await PATCH(
      makePatch(
        'http://test/api/admin/users/u1/role',
        { role: 'ADMIN' },
        {
          'x-forwarded-for': '203.0.113.9',
          'user-agent': 'Mozilla/5.0',
        },
      ),
      paramsOf('u1'),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: { id: 'u1', role: 'ADMIN' } });
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: 'super_1',
        action: 'user.role_change',
        targetType: 'User',
        targetId: 'u1',
        metadata: { from: 'USER', to: 'ADMIN' },
        ip: '203.0.113.9',
        userAgent: 'Mozilla/5.0',
      }),
    );
  });

  it('refuses to demote the last SUPERADMIN (409 LAST_SUPERADMIN)', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: 'u1', role: 'SUPERADMIN' } as never);
    prismaMock.user.count.mockResolvedValueOnce(1);

    const res = await PATCH(
      makePatch('http://test/api/admin/users/u1/role', { role: 'ADMIN' }),
      paramsOf('u1'),
    );

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('LAST_SUPERADMIN');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(mockLogAdminAction).not.toHaveBeenCalled();
  });

  it('demoting a SUPERADMIN succeeds when at least 2 exist', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: 'u1', role: 'SUPERADMIN' } as never);
    prismaMock.user.count.mockResolvedValueOnce(2);
    prismaMock.user.update.mockResolvedValueOnce({ id: 'u1', role: 'ADMIN' } as never);

    const res = await PATCH(
      makePatch('http://test/api/admin/users/u1/role', { role: 'ADMIN' }),
      paramsOf('u1'),
    );

    expect(res.status).toBe(200);
    expect(mockLogAdminAction).toHaveBeenCalledOnce();
  });

  it('404s on a missing user', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);

    const res = await PATCH(
      makePatch('http://test/api/admin/users/missing/role', { role: 'ADMIN' }),
      paramsOf('missing'),
    );

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('USER_NOT_FOUND');
  });

  it('rejects when CSRF fails, before touching auth or the DB', async () => {
    mockVerifyCsrf.mockReturnValueOnce(
      NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 }),
    );

    const res = await PATCH(
      makePatch('http://test/api/admin/users/u1/role', { role: 'ADMIN' }),
      paramsOf('u1'),
    );

    expect(res.status).toBe(403);
    expect(mockRequireSuperadmin).not.toHaveBeenCalled();
  });

  it('403s a plain ADMIN (SUPERADMIN-only)', async () => {
    mockRequireSuperadmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );

    const res = await PATCH(
      makePatch('http://test/api/admin/users/u1/role', { role: 'ADMIN' }),
      paramsOf('u1'),
    );

    expect(res.status).toBe(403);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('propagates 429 from the rate limiter without touching the DB', async () => {
    mockRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 }),
    );

    const res = await PATCH(
      makePatch('http://test/api/admin/users/u1/role', { role: 'ADMIN' }),
      paramsOf('u1'),
    );

    expect(res.status).toBe(429);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });
});
