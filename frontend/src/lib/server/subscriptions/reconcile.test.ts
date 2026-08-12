import { describe, it, expect, vi } from 'vitest';
import { reconcileChariowOrderCore, reconcileChariowOrder } from './reconcile';

function baseOrder(over: Record<string, unknown> = {}) {
  return {
    id: 'order_1',
    userId: 'user_1',
    provider: 'chariow',
    providerChargeId: 'sale_1',
    status: 'PENDING',
    amount: 5900,
    currency: 'XOF',
    metadata: { plan: 'ESSENTIEL' },
    createdAt: new Date('2026-08-01T00:00:00Z'),
    paidAt: null,
    ...over,
  } as never;
}

function makeTx() {
  const orderUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
  const userFindUnique = vi.fn().mockResolvedValue({ planExpiresAt: null });
  const userUpdate = vi.fn().mockResolvedValue({});
  const outboxCreate = vi.fn().mockResolvedValue({ id: 'ob1' });
  return {
    tx: {
      order: { updateMany: orderUpdateMany },
      user: { findUnique: userFindUnique, update: userUpdate },
      outboxEvent: { create: outboxCreate },
    },
    orderUpdateMany,
    userFindUnique,
    userUpdate,
    outboxCreate,
  };
}

describe('reconcileChariowOrderCore', () => {
  it('is a no-op when the order is already PAID', async () => {
    const { tx, orderUpdateMany } = makeTx();
    const provider = { getSaleStatus: vi.fn() };
    const result = await reconcileChariowOrderCore(
      tx as never,
      baseOrder({ status: 'PAID' }),
      provider,
    );
    expect(result).toBe('PAID');
    expect(provider.getSaleStatus).not.toHaveBeenCalled();
    expect(orderUpdateMany).not.toHaveBeenCalled();
  });

  it('leaves the order PENDING when Chariow reports a pending sale', async () => {
    const { tx, orderUpdateMany } = makeTx();
    const provider = {
      getSaleStatus: vi.fn(async () => ({
        status: 'processing',
        amount: { value: 5900, currency: 'XOF' },
        paidAt: null,
      })),
    };
    const result = await reconcileChariowOrderCore(tx as never, baseOrder(), provider);
    expect(result).toBe('PENDING');
    expect(orderUpdateMany).not.toHaveBeenCalled();
  });

  it('flips the order to FAILED when Chariow reports failed/abandoned', async () => {
    const { tx, orderUpdateMany } = makeTx();
    const provider = {
      getSaleStatus: vi.fn(async () => ({
        status: 'cancelled',
        amount: { value: 5900, currency: 'XOF' },
        paidAt: null,
      })),
    };
    const result = await reconcileChariowOrderCore(tx as never, baseOrder(), provider);
    expect(result).toBe('FAILED');
    expect(orderUpdateMany).toHaveBeenCalledWith({
      where: { id: 'order_1', status: { in: ['PENDING', 'FAILED'] } },
      data: { status: 'FAILED' },
    });
  });

  it('credits the plan on a succeeded sale within amount tolerance', async () => {
    const { tx, orderUpdateMany, userUpdate, outboxCreate } = makeTx();
    const provider = {
      getSaleStatus: vi.fn(async () => ({
        status: 'settled',
        amount: { value: 5900, currency: 'XOF' },
        paidAt: new Date('2026-08-11T09:00:00Z'),
      })),
    };
    const result = await reconcileChariowOrderCore(tx as never, baseOrder(), provider);
    expect(result).toBe('PAID');
    expect(orderUpdateMany).toHaveBeenCalledWith({
      where: { id: 'order_1', status: { in: ['PENDING', 'FAILED'] } },
      data: { status: 'PAID', paidAt: new Date('2026-08-11T09:00:00Z') },
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: {
        plan: 'ESSENTIEL',
        planExpiresAt: new Date('2026-08-01T00:00:00Z').getTime() > 0 ? expect.any(Date) : null,
      },
    });
    expect(outboxCreate).toHaveBeenCalledOnce();
    const outboxArgs = outboxCreate.mock.calls[0]?.[0];
    expect(outboxArgs?.data.kind).toBe('notification.plan_activated');
  });

  it('falls back to order.createdAt when Chariow gives no settlement date (never "now")', async () => {
    const { tx, orderUpdateMany } = makeTx();
    const provider = {
      getSaleStatus: vi.fn(async () => ({
        status: 'settled',
        amount: { value: 5900, currency: 'XOF' },
        paidAt: null,
      })),
    };
    await reconcileChariowOrderCore(tx as never, baseOrder(), provider);
    expect(orderUpdateMany).toHaveBeenCalledWith({
      where: { id: 'order_1', status: { in: ['PENDING', 'FAILED'] } },
      data: { status: 'PAID', paidAt: new Date('2026-08-01T00:00:00Z') },
    });
  });

  it('extends planExpiresAt from the current expiry when still active (early renewal)', async () => {
    const { tx, userUpdate, userFindUnique } = makeTx();
    userFindUnique.mockResolvedValueOnce({
      planExpiresAt: new Date('2026-09-01T00:00:00Z'),
    } as never);
    const provider = {
      getSaleStatus: vi.fn(async () => ({
        status: 'settled',
        amount: { value: 5900, currency: 'XOF' },
        paidAt: new Date('2026-08-11T09:00:00Z'),
      })),
    };
    await reconcileChariowOrderCore(tx as never, baseOrder(), provider);
    const updateArgs = userUpdate.mock.calls[0]?.[0];
    expect(updateArgs?.data.planExpiresAt).toEqual(new Date('2026-10-01T00:00:00Z'));
  });

  it('does NOT credit when the amount is outside the 5% tolerance (anti-fraude)', async () => {
    const { tx, orderUpdateMany, userUpdate } = makeTx();
    const provider = {
      getSaleStatus: vi.fn(async () => ({
        status: 'settled',
        amount: { value: 100, currency: 'XOF' }, // wildly under the 5900 expected
        paidAt: new Date('2026-08-11T09:00:00Z'),
      })),
    };
    const result = await reconcileChariowOrderCore(tx as never, baseOrder(), provider);
    expect(result).toBe('PENDING');
    expect(orderUpdateMany).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('is idempotent when a concurrent reconcile already flipped the order (updateMany count 0)', async () => {
    const { tx, orderUpdateMany, userUpdate } = makeTx();
    orderUpdateMany.mockResolvedValueOnce({ count: 0 });
    const provider = {
      getSaleStatus: vi.fn(async () => ({
        status: 'settled',
        amount: { value: 5900, currency: 'XOF' },
        paidAt: new Date('2026-08-11T09:00:00Z'),
      })),
    };
    const result = await reconcileChariowOrderCore(tx as never, baseOrder(), provider);
    expect(result).toBe('PAID');
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('does not call the provider when providerChargeId is missing', async () => {
    const { tx } = makeTx();
    const provider = { getSaleStatus: vi.fn() };
    const result = await reconcileChariowOrderCore(
      tx as never,
      baseOrder({ providerChargeId: null }),
      provider,
    );
    expect(result).toBe('PENDING');
    expect(provider.getSaleStatus).not.toHaveBeenCalled();
  });
});

describe('reconcileChariowOrder', () => {
  it('opens its own Serializable transaction and delegates to the core', async () => {
    const $transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>, opts?: unknown) => {
      expect(opts).toEqual({ isolationLevel: 'Serializable' });
      return fn(makeTx().tx);
    });
    const prisma = { $transaction } as never;
    const provider = {
      getSaleStatus: vi.fn(async () => ({
        status: 'processing',
        amount: { value: 5900, currency: 'XOF' },
        paidAt: null,
      })),
    };
    const result = await reconcileChariowOrder({ prisma, order: baseOrder(), provider });
    expect(result).toBe('PENDING');
    expect($transaction).toHaveBeenCalledOnce();
  });

  it('short-circuits without opening a transaction when the order is already PAID', async () => {
    const $transaction = vi.fn();
    const prisma = { $transaction } as never;
    const provider = { getSaleStatus: vi.fn() };
    const result = await reconcileChariowOrder({
      prisma,
      order: baseOrder({ status: 'PAID' }),
      provider,
    });
    expect(result).toBe('PAID');
    expect($transaction).not.toHaveBeenCalled();
  });
});
