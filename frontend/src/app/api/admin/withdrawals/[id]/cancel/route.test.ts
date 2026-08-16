// POST /api/admin/withdrawals/[id]/cancel — no test file existed for this
// route before now. Mirrors the mocking pattern established elsewhere in
// this session (requireSuperadmin/verifyCsrf/rate-limit/logAdminAction),
// with the Serializable-tx + lockUserTx shape unwrapped via the
// $transaction passthrough (lockUserTx's own $executeRawUnsafe call
// resolves via prismaMock's auto-mock — no dedicated mock needed).
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
import { POST } from './route';

const mockRequireSuperadmin = vi.mocked(requireSuperadmin);
const mockRateLimit = vi.mocked(enforceAdminRateLimit);
const mockVerifyCsrf = vi.mocked(verifyCsrf);
const mockLogAdminAction = vi.mocked(logAdminAction);

const superadminCtx = {
  user: { sub: 'super_1', email: 'super@test.local' },
  admin: { id: 'super_1', email: 'super@test.local', role: 'SUPERADMIN' as const },
};

function makePost(url: string, body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
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

describe('POST /api/admin/withdrawals/[id]/cancel', () => {
  it('happy path: cancels a PENDING withdrawal, audited with ip/userAgent', async () => {
    prismaMock.withdrawal.findUnique
      .mockResolvedValueOnce({ userId: 'u1' } as never) // Phase 1 — owner lookup
      .mockResolvedValueOnce({
        id: 'wd1',
        userId: 'u1',
        status: 'PENDING',
        amount: 5000,
        currency: 'XOF',
        processedAt: null,
      } as never); // Phase 2 — re-fetch under lock
    prismaMock.withdrawal.update.mockResolvedValueOnce({
      id: 'wd1',
      status: 'CANCELLED',
    } as never);

    const res = await POST(
      makePost(
        'http://test/api/admin/withdrawals/wd1/cancel',
        { reason: 'fraudulent' },
        { 'x-forwarded-for': '203.0.113.9', 'user-agent': 'Mozilla/5.0' },
      ),
      paramsOf('wd1'),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ withdrawal: { id: 'wd1', status: 'CANCELLED' } });
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: 'super_1',
        action: 'withdrawal.cancel',
        targetType: 'Withdrawal',
        targetId: 'wd1',
        metadata: expect.objectContaining({
          withdrawalId: 'wd1',
          amount: 5000,
          currency: 'XOF',
          reason: 'fraudulent',
          previousStatus: 'PENDING',
        }),
        ip: '203.0.113.9',
        userAgent: 'Mozilla/5.0',
      }),
    );
  });

  it('409s a withdrawal that is not in a cancellable state', async () => {
    prismaMock.withdrawal.findUnique
      .mockResolvedValueOnce({ userId: 'u1' } as never)
      .mockResolvedValueOnce({
        id: 'wd1',
        userId: 'u1',
        status: 'COMPLETED',
        amount: 5000,
        currency: 'XOF',
        processedAt: new Date(),
      } as never);

    const res = await POST(
      makePost('http://test/api/admin/withdrawals/wd1/cancel', { reason: 'oops' }),
      paramsOf('wd1'),
    );

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('WITHDRAWAL_NOT_CANCELLABLE');
    expect(prismaMock.withdrawal.update).not.toHaveBeenCalled();
    expect(mockLogAdminAction).not.toHaveBeenCalled();
  });

  it('404s on a missing withdrawal (Phase 1 owner lookup)', async () => {
    prismaMock.withdrawal.findUnique.mockResolvedValueOnce(null);

    const res = await POST(
      makePost('http://test/api/admin/withdrawals/missing/cancel', { reason: 'oops' }),
      paramsOf('missing'),
    );

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('WITHDRAWAL_NOT_FOUND');
  });

  it('rejects when CSRF fails, before touching auth or the DB', async () => {
    mockVerifyCsrf.mockReturnValueOnce(
      NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 }),
    );

    const res = await POST(
      makePost('http://test/api/admin/withdrawals/wd1/cancel', { reason: 'oops' }),
      paramsOf('wd1'),
    );

    expect(res.status).toBe(403);
    expect(mockRequireSuperadmin).not.toHaveBeenCalled();
  });

  it('403s a plain ADMIN (SUPERADMIN-only)', async () => {
    mockRequireSuperadmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );

    const res = await POST(
      makePost('http://test/api/admin/withdrawals/wd1/cancel', { reason: 'oops' }),
      paramsOf('wd1'),
    );

    expect(res.status).toBe(403);
    expect(prismaMock.withdrawal.findUnique).not.toHaveBeenCalled();
  });

  it('propagates 429 from the rate limiter without touching the DB', async () => {
    mockRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 }),
    );

    const res = await POST(
      makePost('http://test/api/admin/withdrawals/wd1/cancel', { reason: 'oops' }),
      paramsOf('wd1'),
    );

    expect(res.status).toBe(429);
    expect(prismaMock.withdrawal.findUnique).not.toHaveBeenCalled();
  });
});
