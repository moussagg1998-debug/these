import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/server/auth', () => ({
  verifyCsrf: vi.fn(() => null),
}));

vi.mock('@/lib/server/middleware', () => ({
  requireAuth: vi.fn(async () => ({ user: { sub: 'user-1', email: 'me@example.com' } })),
}));

// NOTE: Vitest hoists every `vi.mock()` call above ALL other top-level
// statements in this file (including preceding `const` declarations), and
// only auto-hoists referenced variables whose name contains "mock"
// (case-insensitive) along with it. `orderFindUnique`, `orderFindFirst`, and
// `userFindUnique` don't match that heuristic, so referencing them directly
// from a `vi.mock()` factory throws "Cannot access '...' before
// initialization" the moment `./route` is statically imported below (its
// transitive imports resolve these mocked modules before this file's own
// body runs). `vi.hoisted()` is Vitest's documented, name-independent fix.
// No test behavior/assertions differ from the task brief — only this
// declaration mechanism (same fix already applied in
// subscriptions/checkout/route.test.ts for the identical issue).
const { getChariowProviderMock } = vi.hoisted(() => ({
  getChariowProviderMock: vi.fn(() => ({ name: 'chariow' })),
}));
vi.mock('@/lib/server/payments/chariow-singleton', () => ({
  getChariowProvider: getChariowProviderMock,
  ChariowProviderUnconfiguredError: class ChariowProviderUnconfiguredError extends Error {},
}));

// `reconcileMock`/`userFindUnique` are typed explicitly below (rather than
// inferred from their initial return value) because several tests later
// call `.mockResolvedValueOnce('PAID')` / `...(planExpiresAt: new Date(...))`
// — inference from `'PENDING'` / `planExpiresAt: null` alone would narrow
// the mock's type to reject those. No behavior differs from the task brief.
const { reconcileMock } = vi.hoisted(() => ({
  reconcileMock: vi.fn(async (): Promise<'PAID' | 'PENDING' | 'FAILED'> => 'PENDING'),
}));
vi.mock('@/lib/server/subscriptions/reconcile', () => ({
  reconcileChariowOrder: reconcileMock,
}));

const { orderFindUnique, orderFindFirst, userFindUnique } = vi.hoisted(() => ({
  orderFindUnique: vi.fn(),
  orderFindFirst: vi.fn(),
  userFindUnique: vi.fn(
    async (): Promise<{ plan: string; planExpiresAt: Date | null }> => ({
      plan: 'FREE',
      planExpiresAt: null,
    }),
  ),
}));
vi.mock('@/lib/server/prisma', () => ({
  prisma: {
    order: { findUnique: orderFindUnique, findFirst: orderFindFirst },
    user: { findUnique: userFindUnique },
  },
}));

import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { POST } from './route';

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://test/api/subscriptions/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(verifyCsrf).mockReturnValue(null);
  vi.mocked(requireAuth).mockResolvedValue({ user: { sub: 'user-1', email: 'me@example.com' } });
  userFindUnique.mockResolvedValue({ plan: 'FREE', planExpiresAt: null });
  reconcileMock.mockResolvedValue('PENDING');
});

describe('POST /api/subscriptions/verify', () => {
  it('reconciles the given orderId and returns status + plan', async () => {
    orderFindUnique.mockResolvedValueOnce({ id: 'o1', userId: 'user-1', provider: 'chariow' });
    reconcileMock.mockResolvedValueOnce('PAID');
    userFindUnique.mockResolvedValueOnce({
      plan: 'ESSENTIEL',
      planExpiresAt: new Date('2026-09-10'),
    });

    const res = await POST(makeReq({ orderId: 'o1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('PAID');
    expect(body.plan).toBe('ESSENTIEL');
    expect(reconcileMock).toHaveBeenCalledOnce();
  });

  it('defaults to the latest chariow order for the user when orderId is omitted', async () => {
    orderFindFirst.mockResolvedValueOnce({ id: 'o-latest', userId: 'user-1', provider: 'chariow' });
    const res = await POST(makeReq({}));
    expect(res.status).toBe(200);
    expect(orderFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', provider: 'chariow' } }),
    );
  });

  it('returns 404 ORDER_NOT_FOUND when the order does not exist', async () => {
    orderFindUnique.mockResolvedValueOnce(null);
    const res = await POST(makeReq({ orderId: 'missing' }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('ORDER_NOT_FOUND');
  });

  it('returns 404 ORDER_NOT_FOUND when the order belongs to another user', async () => {
    orderFindUnique.mockResolvedValueOnce({
      id: 'o1',
      userId: 'someone-else',
      provider: 'chariow',
    });
    const res = await POST(makeReq({ orderId: 'o1' }));
    expect(res.status).toBe(404);
  });

  it('returns 403 when CSRF fails (checked before auth)', async () => {
    vi.mocked(verifyCsrf).mockReturnValue(
      NextResponse.json({ error: 'CSRF_FAILED' }, { status: 403 }),
    );
    const res = await POST(makeReq({ orderId: 'o1' }));
    expect(res.status).toBe(403);
    expect(requireAuth).not.toHaveBeenCalled();
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(
      NextResponse.json({ error: 'Missing token' }, { status: 401 }),
    );
    const res = await POST(makeReq({ orderId: 'o1' }));
    expect(res.status).toBe(401);
  });

  it('returns a graceful PENDING (not a 500) when reconcile hits a P2034 serialization conflict with the webhook', async () => {
    orderFindUnique.mockResolvedValueOnce({ id: 'o1', userId: 'user-1', provider: 'chariow' });
    reconcileMock.mockRejectedValueOnce(
      Object.assign(new Error('Transaction failed due to a write conflict'), { code: 'P2034' }),
    );
    const res = await POST(makeReq({ orderId: 'o1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('PENDING');
  });

  it('does not swallow a non-P2034 error from reconcile', async () => {
    orderFindUnique.mockResolvedValueOnce({ id: 'o1', userId: 'user-1', provider: 'chariow' });
    reconcileMock.mockRejectedValueOnce(new Error('Chariow API unreachable'));
    await expect(POST(makeReq({ orderId: 'o1' }))).rejects.toThrow('Chariow API unreachable');
  });

  it('returns 503 PAYMENT_PROVIDER_UNCONFIGURED when Chariow env is missing', async () => {
    orderFindUnique.mockResolvedValueOnce({ id: 'o1', userId: 'user-1', provider: 'chariow' });
    const { ChariowProviderUnconfiguredError } =
      await import('@/lib/server/payments/chariow-singleton');
    getChariowProviderMock.mockImplementationOnce(() => {
      throw new ChariowProviderUnconfiguredError();
    });
    const res = await POST(makeReq({ orderId: 'o1' }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('PAYMENT_PROVIDER_UNCONFIGURED');
  });
});
