// Admin-triggered password reset — mirrors POST /api/auth/forgot-password's
// issuance semantics (VerificationCode + outbox email), but authenticated
// and fully audited via logAdminAction, all inside one transaction.
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
import { POST } from './route';
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

function makePost(url: string): NextRequest {
  return new NextRequest(url, { method: 'POST' });
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

describe('POST /api/admin/users/[id]/reset-password', () => {
  it('happy path: creates a PASSWORD_RESET code, enqueues the email, and audits the action', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'u1',
      email: 'target@test.local',
    } as never);
    prismaMock.verificationCode.create.mockResolvedValueOnce({ id: 'vc1' } as never);
    prismaMock.outboxEvent.create.mockResolvedValueOnce({ id: 'ob1' } as never);

    const res = await POST(
      makePost('http://test/api/admin/users/u1/reset-password'),
      paramsOf('u1'),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    expect(prismaMock.verificationCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'u1', type: 'PASSWORD_RESET' }),
      }),
    );
    expect(prismaMock.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'email.password_reset' }),
      }),
    );
    const outboxArg = prismaMock.outboxEvent.create.mock.calls[0]?.[0] as unknown as {
      data: { payload: { to: string } };
    };
    expect(outboxArg.data.payload.to).toBe('target@test.local');

    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: adminUser.id,
        action: 'user.password_reset',
        targetType: 'User',
        targetId: 'u1',
      }),
    );
  });

  it('404s on a missing user, writes no code/outbox/audit row', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);

    const res = await POST(
      makePost('http://test/api/admin/users/missing/reset-password'),
      paramsOf('missing'),
    );

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('USER_NOT_FOUND');
    expect(prismaMock.verificationCode.create).not.toHaveBeenCalled();
    expect(prismaMock.outboxEvent.create).not.toHaveBeenCalled();
    expect(mockLogAdminAction).not.toHaveBeenCalled();
  });

  it('rejects when CSRF fails, before touching auth or the DB', async () => {
    mockVerifyCsrf.mockReturnValueOnce(
      NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 }),
    );

    const res = await POST(
      makePost('http://test/api/admin/users/u1/reset-password'),
      paramsOf('u1'),
    );

    expect(res.status).toBe(403);
    expect(mockRequireAdmin).not.toHaveBeenCalled();
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('propagates 403 from requireAdmin (non-admin caller)', async () => {
    mockRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );

    const res = await POST(
      makePost('http://test/api/admin/users/u1/reset-password'),
      paramsOf('u1'),
    );

    expect(res.status).toBe(403);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('propagates 429 from the rate limiter without touching the DB', async () => {
    mockRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 }),
    );

    const res = await POST(
      makePost('http://test/api/admin/users/u1/reset-password'),
      paramsOf('u1'),
    );

    expect(res.status).toBe(429);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });
});
