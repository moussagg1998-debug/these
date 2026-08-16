import { describe, it, expect, vi } from 'vitest';
import { activatePlanFromOrder } from './activate';

function makeTx(overrides: { planExpiresAt?: Date | null } = {}) {
  const userFindUnique = vi
    .fn()
    .mockResolvedValue({ planExpiresAt: overrides.planExpiresAt ?? null });
  const userUpdate = vi.fn().mockResolvedValue({});
  const outboxCreate = vi.fn().mockResolvedValue({ id: 'ob1' });
  return {
    tx: {
      user: { findUnique: userFindUnique, update: userUpdate },
      outboxEvent: { create: outboxCreate },
    },
    userFindUnique,
    userUpdate,
    outboxCreate,
  };
}

describe('activatePlanFromOrder', () => {
  it('activates from now when the user has no current expiry', async () => {
    const { tx, userUpdate } = makeTx({ planExpiresAt: null });
    const before = Date.now();
    const result = await activatePlanFromOrder(tx as never, {
      userId: 'user_1',
      orderId: 'order_1',
      plan: 'ESSENTIEL',
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { plan: 'ESSENTIEL', planExpiresAt: expect.any(Date) },
    });
    expect(result.planExpiresAt.getTime()).toBeGreaterThanOrEqual(
      before + 29 * 24 * 60 * 60 * 1000,
    );
  });

  it('extends from the current expiry when still active (early renewal)', async () => {
    const { tx, userUpdate } = makeTx({ planExpiresAt: new Date('2026-09-01T00:00:00Z') });
    await activatePlanFromOrder(tx as never, {
      userId: 'user_1',
      orderId: 'order_1',
      plan: 'ESSENTIEL',
    });
    const updateArgs = userUpdate.mock.calls[0]?.[0];
    expect(updateArgs?.data.planExpiresAt).toEqual(new Date('2026-10-01T00:00:00Z'));
  });

  it('restarts from now when the current expiry is already in the past', async () => {
    const { tx, userUpdate } = makeTx({ planExpiresAt: new Date('2020-01-01T00:00:00Z') });
    const before = Date.now();
    await activatePlanFromOrder(tx as never, {
      userId: 'user_1',
      orderId: 'order_1',
      plan: 'ESSENTIEL',
    });
    const updateArgs = userUpdate.mock.calls[0]?.[0];
    expect((updateArgs?.data.planExpiresAt as Date).getTime()).toBeGreaterThanOrEqual(
      before + 29 * 24 * 60 * 60 * 1000,
    );
  });

  it('enqueues a notification.plan_activated outbox event with the expiry ISO string', async () => {
    const { tx, outboxCreate } = makeTx({ planExpiresAt: null });
    const result = await activatePlanFromOrder(tx as never, {
      userId: 'user_1',
      orderId: 'order_1',
      plan: 'ESSENTIEL',
    });
    expect(outboxCreate).toHaveBeenCalledOnce();
    const args = outboxCreate.mock.calls[0]?.[0];
    expect(args?.data.kind).toBe('notification.plan_activated');
    expect(args?.data.payload).toEqual({
      userId: 'user_1',
      orderId: 'order_1',
      plan: 'ESSENTIEL',
      expiresAt: result.planExpiresAt.toISOString(),
    });
  });

  it('returns the computed planExpiresAt', async () => {
    const { tx } = makeTx({ planExpiresAt: new Date('2026-09-01T00:00:00Z') });
    const result = await activatePlanFromOrder(tx as never, {
      userId: 'user_1',
      orderId: 'order_1',
      plan: 'ESSENTIEL',
    });
    expect(result).toEqual({ planExpiresAt: new Date('2026-10-01T00:00:00Z') });
  });
});
