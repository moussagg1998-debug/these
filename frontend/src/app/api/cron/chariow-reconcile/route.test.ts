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

const reconcileMock = vi.fn(async (): Promise<'PAID' | 'PENDING' | 'FAILED'> => 'PENDING');
vi.mock('@/lib/server/subscriptions/reconcile', () => ({
  reconcileChariowOrder: reconcileMock,
}));

const orderFindMany = vi.fn(
  async (_args: { where: Record<string, unknown>; orderBy?: Record<string, unknown> }) =>
    [] as Array<{
      id: string;
      status: string;
    }>,
);
const orderUpdateMany = vi.fn(async (_args?: unknown) => ({ count: 1 }));
vi.mock('@/lib/server/prisma', () => ({
  prisma: { order: { findMany: orderFindMany, updateMany: orderUpdateMany } },
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
    const callArg = orderFindMany.mock.calls[0]![0];
    expect(callArg.where.provider).toBe('chariow');
    expect(callArg.where.OR).toEqual([
      { status: 'PENDING' },
      { status: 'FAILED', updatedAt: { gte: expect.any(Date) } },
      // A settlement landing after checkout's 2h expiry must still be caught.
      { status: 'EXPIRED', updatedAt: { gte: expect.any(Date) } },
    ]);
  });

  it('excludes orders with no providerChargeId — they can never be credited and would only crowd out real work', async () => {
    const { POST } = await import('./route');
    await POST(makeReq());
    const callArg = orderFindMany.mock.calls[0]![0];
    expect(callArg.where.providerChargeId).toEqual({ not: null });
  });

  it('orders the batch by updatedAt ascending, not createdAt — a repeatedly-failing order must not permanently sort first', async () => {
    const { POST } = await import('./route');
    await POST(makeReq());
    const callArg = orderFindMany.mock.calls[0]![0];
    expect(callArg.orderBy).toEqual({ updatedAt: 'asc' });
  });

  it('one order throwing during reconciliation does not stop the rest of the batch, and is logged + touched so it rotates back', async () => {
    orderFindMany.mockResolvedValueOnce([
      { id: 'o1', status: 'PENDING' },
      { id: 'o2', status: 'PENDING' },
      { id: 'o3', status: 'PENDING' },
    ]);
    reconcileMock
      .mockResolvedValueOnce('PENDING')
      .mockRejectedValueOnce(new Error('Chariow 404: sale deleted'))
      .mockResolvedValueOnce('PAID');
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    // all 3 attempted despite the middle one throwing
    expect(body.processed).toBe(3);
    expect(reconcileMock).toHaveBeenCalledTimes(3);
    // the thrower (o2) gets touched so it doesn't sort first again next tick
    expect(orderUpdateMany).toHaveBeenCalledWith({
      where: { id: 'o2', status: 'PENDING' },
      data: { updatedAt: expect.any(Date) },
    });
  });

  it('touches an unresolved PENDING order (still PENDING outcome) so it rotates to the back of the next batch', async () => {
    orderFindMany.mockResolvedValueOnce([{ id: 'o1', status: 'PENDING' }]);
    reconcileMock.mockResolvedValueOnce('PENDING');
    const { POST } = await import('./route');
    await POST(makeReq());
    expect(orderUpdateMany).toHaveBeenCalledWith({
      where: { id: 'o1', status: 'PENDING' },
      data: { updatedAt: expect.any(Date) },
    });
  });

  it('does NOT touch an order that resolved to PAID — no need to rotate a row that just left the candidate set', async () => {
    orderFindMany.mockResolvedValueOnce([{ id: 'o1', status: 'PENDING' }]);
    reconcileMock.mockResolvedValueOnce('PAID');
    const { POST } = await import('./route');
    await POST(makeReq());
    expect(orderUpdateMany).not.toHaveBeenCalled();
  });

  it('does NOT touch a FAILED/EXPIRED candidate that stays unresolved — those age out via the catch-up window instead', async () => {
    orderFindMany.mockResolvedValueOnce([{ id: 'o1', status: 'EXPIRED' }]);
    reconcileMock.mockResolvedValueOnce('PENDING');
    const { POST } = await import('./route');
    await POST(makeReq());
    expect(orderUpdateMany).not.toHaveBeenCalled();
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
