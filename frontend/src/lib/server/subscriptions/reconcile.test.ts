import { describe, it, expect, vi, beforeEach } from 'vitest';

// `reconcile.ts` calls `createLogger()` once at module scope, so the spy has
// to be installed before the module is imported — hence `vi.hoisted`.
const { loggerErrorSpy, loggerWarnSpy } = vi.hoisted(() => ({
  loggerErrorSpy: vi.fn(),
  loggerWarnSpy: vi.fn(),
}));
vi.mock('../logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: loggerWarnSpy,
    error: loggerErrorSpy,
  }),
}));

import { reconcileChariowOrderCore, reconcileChariowOrder } from './reconcile';

/** Status guard shared by every `updateMany` in `reconcile.ts`. */
const RECHECKABLE = { in: ['PENDING', 'FAILED', 'EXPIRED'] };

beforeEach(() => {
  loggerErrorSpy.mockClear();
  loggerWarnSpy.mockClear();
});

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
  const executeRawUnsafe = vi.fn().mockResolvedValue(0);
  return {
    tx: {
      order: { updateMany: orderUpdateMany },
      user: { findUnique: userFindUnique, update: userUpdate },
      outboxEvent: { create: outboxCreate },
      $executeRawUnsafe: executeRawUnsafe,
    },
    orderUpdateMany,
    userFindUnique,
    userUpdate,
    outboxCreate,
    executeRawUnsafe,
  };
}

describe('reconcileChariowOrderCore', () => {
  it('is a no-op when the order is already PAID', async () => {
    const { tx, orderUpdateMany, executeRawUnsafe } = makeTx();
    const provider = { getSaleStatus: vi.fn() };
    const result = await reconcileChariowOrderCore(
      tx as never,
      baseOrder({ status: 'PAID' }),
      provider,
    );
    expect(result).toBe('PAID');
    expect(provider.getSaleStatus).not.toHaveBeenCalled();
    expect(orderUpdateMany).not.toHaveBeenCalled();
    // Already settled — nothing to serialize against, so no lock needed.
    expect(executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('takes the subscription advisory lock, namespaced to the order owner, before doing anything else', async () => {
    const { tx, executeRawUnsafe } = makeTx();
    const provider = {
      getSaleStatus: vi.fn(async () => ({
        status: 'processing',
        amount: { value: 5900, currency: 'XOF' },
        paidAt: null,
      })),
    };
    await reconcileChariowOrderCore(tx as never, baseOrder({ userId: 'user_42' }), provider);
    expect(executeRawUnsafe).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      'subscription:user_42',
    );
    // Locked before the remote pull — the whole point is to serialize with
    // the webhook path around that same network call.
    expect(executeRawUnsafe.mock.invocationCallOrder[0]).toBeLessThan(
      provider.getSaleStatus.mock.invocationCallOrder[0]!,
    );
  });

  it('does not attempt to take a lock for a guest order (no userId)', async () => {
    const { tx, executeRawUnsafe } = makeTx();
    const provider = {
      getSaleStatus: vi.fn(async () => ({
        status: 'processing',
        amount: { value: 5900, currency: 'XOF' },
        paidAt: null,
      })),
    };
    await reconcileChariowOrderCore(tx as never, baseOrder({ userId: null }), provider);
    expect(executeRawUnsafe).not.toHaveBeenCalled();
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
      where: { id: 'order_1', status: RECHECKABLE },
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
      where: { id: 'order_1', status: RECHECKABLE },
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
      where: { id: 'order_1', status: RECHECKABLE },
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

  it('credits an EXPIRED order whose remote Chariow status is succeeded (late settlement)', async () => {
    const { tx, orderUpdateMany, userUpdate, outboxCreate } = makeTx();
    const provider = {
      getSaleStatus: vi.fn(async () => ({
        status: 'settled',
        amount: { value: 5900, currency: 'XOF' },
        paidAt: new Date('2026-08-11T09:00:00Z'),
      })),
    };
    const result = await reconcileChariowOrderCore(
      tx as never,
      baseOrder({ status: 'EXPIRED' }),
      provider,
    );
    expect(result).toBe('PAID');
    // The re-pull is the whole point — never concluded from local state.
    expect(provider.getSaleStatus).toHaveBeenCalledWith('sale_1', {});
    expect(orderUpdateMany).toHaveBeenCalledWith({
      where: { id: 'order_1', status: RECHECKABLE },
      data: { status: 'PAID', paidAt: new Date('2026-08-11T09:00:00Z') },
    });
    expect(userUpdate).toHaveBeenCalledOnce();
    expect(outboxCreate).toHaveBeenCalledOnce();
  });

  it('still enforces the amount anti-fraude guard on an EXPIRED order', async () => {
    const { tx, orderUpdateMany, userUpdate } = makeTx();
    const provider = {
      getSaleStatus: vi.fn(async () => ({
        status: 'settled',
        amount: { value: 100, currency: 'XOF' }, // way under the 5900 expected
        paidAt: new Date('2026-08-11T09:00:00Z'),
      })),
    };
    const result = await reconcileChariowOrderCore(
      tx as never,
      baseOrder({ status: 'EXPIRED' }),
      provider,
    );
    expect(result).toBe('PENDING');
    expect(orderUpdateMany).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
    expect(loggerWarnSpy).toHaveBeenCalled();
  });

  it('still dedupes an EXPIRED order a concurrent reconcile already credited', async () => {
    const { tx, orderUpdateMany, userUpdate, outboxCreate } = makeTx();
    orderUpdateMany.mockResolvedValueOnce({ count: 0 });
    const provider = {
      getSaleStatus: vi.fn(async () => ({
        status: 'settled',
        amount: { value: 5900, currency: 'XOF' },
        paidAt: new Date('2026-08-11T09:00:00Z'),
      })),
    };
    const result = await reconcileChariowOrderCore(
      tx as never,
      baseOrder({ status: 'EXPIRED' }),
      provider,
    );
    expect(result).toBe('PAID');
    expect(userUpdate).not.toHaveBeenCalled();
    expect(outboxCreate).not.toHaveBeenCalled();
  });

  it('leaves an EXPIRED order uncredited (and unwritten) when Chariow still reports it unpaid', async () => {
    const { tx, orderUpdateMany, userUpdate } = makeTx();
    const provider = {
      getSaleStatus: vi.fn(async () => ({
        status: 'processing',
        amount: { value: 5900, currency: 'XOF' },
        paidAt: null,
      })),
    };
    const result = await reconcileChariowOrderCore(
      tx as never,
      baseOrder({ status: 'EXPIRED' }),
      provider,
    );
    expect(result).toBe('PENDING');
    expect(orderUpdateMany).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('does NOT rewrite an EXPIRED order to FAILED when Chariow confirms the failure', async () => {
    const { tx, orderUpdateMany } = makeTx();
    const provider = {
      getSaleStatus: vi.fn(async () => ({
        status: 'cancelled',
        amount: { value: 5900, currency: 'XOF' },
        paidAt: null,
      })),
    };
    const result = await reconcileChariowOrderCore(
      tx as never,
      baseOrder({ status: 'EXPIRED' }),
      provider,
    );
    expect(result).toBe('FAILED');
    // Rewriting would bump `updatedAt` and restart the cron catch-up window
    // on a dead order, and erase why the order actually closed.
    expect(orderUpdateMany).not.toHaveBeenCalled();
  });

  it('logs an error instead of silently returning FAILED for a genuinely terminal state', async () => {
    const { tx, orderUpdateMany } = makeTx();
    const provider = { getSaleStatus: vi.fn() };
    const result = await reconcileChariowOrderCore(
      tx as never,
      baseOrder({ status: 'REFUNDED' }),
      provider,
    );
    expect(result).toBe('FAILED');
    expect(provider.getSaleStatus).not.toHaveBeenCalled();
    expect(orderUpdateMany).not.toHaveBeenCalled();
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('terminal state'),
      expect.objectContaining({ orderId: 'order_1', status: 'REFUNDED' }),
    );
  });

  it('refuses to re-verify a FAILED order stamped cancelledReason: superseded, even though FAILED is otherwise recheckable', async () => {
    const { tx, orderUpdateMany } = makeTx();
    const provider = { getSaleStatus: vi.fn() };
    const result = await reconcileChariowOrderCore(
      tx as never,
      baseOrder({
        status: 'FAILED',
        metadata: { plan: 'ESSENTIEL', cancelledReason: 'superseded' },
      }),
      provider,
    );
    expect(result).toBe('FAILED');
    // Not re-pulled and not re-written — a superseded order was abandoned
    // in favor of an attempt that already credited the plan (e.g. a coupon
    // redemption); re-verifying it here would double-credit on top of that.
    expect(provider.getSaleStatus).not.toHaveBeenCalled();
    expect(orderUpdateMany).not.toHaveBeenCalled();
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('superseded'),
      expect.objectContaining({ orderId: 'order_1' }),
    );
  });

  it('still re-verifies a genuinely-FAILED order without cancelledReason: superseded (recheckability preserved)', async () => {
    const { tx, orderUpdateMany } = makeTx();
    const provider = {
      getSaleStatus: vi.fn().mockResolvedValue({
        status: 'settled',
        amount: { value: 5900, currency: 'XOF' },
        paidAt: new Date('2026-08-02T00:00:00Z'),
      }),
    };
    const result = await reconcileChariowOrderCore(
      tx as never,
      baseOrder({ status: 'FAILED' }),
      provider,
    );
    expect(result).toBe('PAID');
    expect(provider.getSaleStatus).toHaveBeenCalledOnce();
    expect(orderUpdateMany).toHaveBeenCalledOnce();
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
  it('opens its own Serializable transaction (with a widened timeout for the lock-wait + pull) and delegates to the core', async () => {
    const $transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>, opts?: unknown) => {
      expect(opts).toEqual({ isolationLevel: 'Serializable', timeout: 35_000 });
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
