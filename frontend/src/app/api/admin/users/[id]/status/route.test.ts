// PATCH /api/admin/users/[id]/status — no test file existed for this route
// before now. Mirrors the mocking pattern established in
// users/[id]/reset-password/route.test.ts (requireAdmin/verifyCsrf/rate-limit/
// logAdminAction/$transaction passthrough).
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

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockRateLimit = vi.mocked(enforceAdminRateLimit);
const mockVerifyCsrf = vi.mocked(verifyCsrf);
const mockLogAdminAction = vi.mocked(logAdminAction);

const adminCtx = {
  user: { sub: 'admin_1', email: 'admin@test.local' },
  admin: { id: 'admin_1', email: 'admin@test.local', role: 'ADMIN' as const },
};
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

describe('PATCH /api/admin/users/[id]/status', () => {
  it('happy path: ACTIVE -> SUSPENDED, audited with ip/userAgent', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'u1',
      status: 'ACTIVE',
      email: 'u1@test.local',
      name: 'U1',
      role: 'USER',
    } as never);
    prismaMock.user.update.mockResolvedValueOnce({ id: 'u1', status: 'SUSPENDED' } as never);

    const res = await PATCH(
      makePatch(
        'http://test/api/admin/users/u1/status',
        { status: 'SUSPENDED', reason: 'fraud' },
        {
          'x-forwarded-for': '203.0.113.9',
          'user-agent': 'Mozilla/5.0',
        },
      ),
      paramsOf('u1'),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: { id: 'u1', status: 'SUSPENDED' } });
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: 'admin_1',
        action: 'user.suspend',
        targetType: 'User',
        targetId: 'u1',
        ip: '203.0.113.9',
        userAgent: 'Mozilla/5.0',
      }),
    );
  });

  it('restore (SUSPENDED -> ACTIVE) by plain ADMIN is rejected with RESTORE_REQUIRES_SUPERADMIN', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'u1',
      status: 'SUSPENDED',
      email: 'u1@test.local',
      name: 'U1',
      role: 'USER',
    } as never);

    const res = await PATCH(
      makePatch('http://test/api/admin/users/u1/status', { status: 'ACTIVE' }),
      paramsOf('u1'),
    );

    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('RESTORE_REQUIRES_SUPERADMIN');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(mockLogAdminAction).not.toHaveBeenCalled();
  });

  it('restore by SUPERADMIN succeeds', async () => {
    mockRequireAdmin.mockResolvedValueOnce(superadminCtx);
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'u1',
      status: 'SUSPENDED',
      email: 'u1@test.local',
      name: 'U1',
      role: 'USER',
    } as never);
    prismaMock.user.update.mockResolvedValueOnce({ id: 'u1', status: 'ACTIVE' } as never);

    const res = await PATCH(
      makePatch('http://test/api/admin/users/u1/status', { status: 'ACTIVE' }),
      paramsOf('u1'),
    );

    expect(res.status).toBe(200);
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'user.restore' }),
    );
  });

  it('suspending a SUPERADMIN target requires a SUPERADMIN actor', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'u_super_target',
      status: 'ACTIVE',
      email: 'target@test.local',
      name: 'T',
      role: 'SUPERADMIN',
    } as never);

    const res = await PATCH(
      makePatch('http://test/api/admin/users/u_super_target/status', { status: 'SUSPENDED' }),
      paramsOf('u_super_target'),
    );

    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('SUSPEND_REQUIRES_SUPERADMIN');
    expect(mockLogAdminAction).not.toHaveBeenCalled();
  });

  it('refuses to let an admin suspend themselves (CANNOT_SUSPEND_SELF), before touching the DB', async () => {
    const res = await PATCH(
      makePatch('http://test/api/admin/users/admin_1/status', { status: 'SUSPENDED' }),
      paramsOf('admin_1'),
    );

    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('CANNOT_SUSPEND_SELF');
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('is idempotent when the status is unchanged: 200, no update, no audit row', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'u1',
      status: 'ACTIVE',
      email: 'u1@test.local',
      name: 'U1',
      role: 'USER',
    } as never);

    const res = await PATCH(
      makePatch('http://test/api/admin/users/u1/status', { status: 'ACTIVE' }),
      paramsOf('u1'),
    );

    expect(res.status).toBe(200);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(mockLogAdminAction).not.toHaveBeenCalled();
  });

  it('404s on a missing user', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);

    const res = await PATCH(
      makePatch('http://test/api/admin/users/missing/status', { status: 'SUSPENDED' }),
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
      makePatch('http://test/api/admin/users/u1/status', { status: 'SUSPENDED' }),
      paramsOf('u1'),
    );

    expect(res.status).toBe(403);
    expect(mockRequireAdmin).not.toHaveBeenCalled();
  });

  it('propagates 429 from the rate limiter without touching the DB', async () => {
    mockRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 }),
    );

    const res = await PATCH(
      makePatch('http://test/api/admin/users/u1/status', { status: 'SUSPENDED' }),
      paramsOf('u1'),
    );

    expect(res.status).toBe(429);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });
});
