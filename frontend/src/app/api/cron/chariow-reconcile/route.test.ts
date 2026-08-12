import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/server/leader-lease', () => ({
  withLease: vi.fn(async (_redis: unknown, _name: string, _ttl: number, fn: () => Promise<void>) =>
    fn(),
  ),
}));

vi.mock('@/lib/server/redis', () => ({ redis: null }));

const getChariowProviderMock = vi.fn(() => ({ name: 'chariow' }));
vi.mock('@/lib/server/payments/chariow-singleton', () => ({
  getChariowProvider: getChariowProviderMock,
  ChariowProviderUnconfiguredError: class ChariowProviderUnconfiguredError extends Error {},
}));

const reconcileMock = vi.fn(async () => 'PENDING' as const);
vi.mock('@/lib/server/subscriptions/reconcile', () => ({
  reconcileChariowOrder: reconcileMock,
}));

const orderFindMany = vi.fn(
  async (_args: { where: Record<string, unknown> }) =>
    [] as Array<{
      id: string;
      status: string;
    }>,
);
vi.mock('@/lib/server/prisma', () => ({
  prisma: { order: { findMany: orderFindMany } },
}));

function makeReq(secret = 'cron-secret'): NextRequest {
  return new NextRequest('http://localhost/api/cron/chariow-reconcile', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  });
}

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'cron-secret');
  vi.clearAllMocks();
  orderFindMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/cron/chariow-reconcile', () => {
  it('returns 401 with a wrong bearer token', async () => {
    const { POST } = await import('./route');
    const res = await POST(makeReq('wrong'));
    expect(res.status).toBe(401);
  });

  it('reconciles every PENDING chariow order and recently-FAILED/EXPIRED ones within the catch-up window', async () => {
    orderFindMany.mockResolvedValueOnce([
      { id: 'o1', status: 'PENDING' },
      { id: 'o2', status: 'FAILED' },
      { id: 'o3', status: 'EXPIRED' },
    ]);
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(3);
    expect(reconcileMock).toHaveBeenCalledTimes(3);
    const whereArg = orderFindMany.mock.calls[0]![0].where;
    expect(whereArg.provider).toBe('chariow');
    expect(whereArg.OR).toEqual([
      { status: 'PENDING' },
      { status: 'FAILED', updatedAt: { gte: expect.any(Date) } },
      // A settlement landing after checkout's 2h expiry must still be caught.
      { status: 'EXPIRED', updatedAt: { gte: expect.any(Date) } },
    ]);
  });

  it('skips the tick (200, processed:0) when Chariow is unconfigured, instead of 500ing the cron', async () => {
    const { ChariowProviderUnconfiguredError } =
      await import('@/lib/server/payments/chariow-singleton');
    getChariowProviderMock.mockImplementationOnce(() => {
      throw new ChariowProviderUnconfiguredError();
    });
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect((await res.json()).processed).toBe(0);
    expect(orderFindMany).not.toHaveBeenCalled();
  });
});
