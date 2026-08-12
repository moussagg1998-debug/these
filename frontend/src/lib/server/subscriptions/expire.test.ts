import { describe, it, expect, vi } from 'vitest';
import { expirePlans } from './expire';

function makePrisma(users: Array<{ id: string; planExpiresAt: Date }>) {
  const updateManyResults = new Map<string, number>();
  const outboxCreate = vi.fn(async (_args: { data: { kind: string; payload: unknown } }) => ({
    id: 'ob1',
  }));
  const userUpdateMany = vi.fn(async ({ where }: { where: { id: string } }) => ({
    count: updateManyResults.get(where.id) ?? 1,
  }));
  const $transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({ user: { updateMany: userUpdateMany }, outboxEvent: { create: outboxCreate } }),
  );
  return {
    prisma: {
      user: { findMany: vi.fn(async () => users), updateMany: userUpdateMany },
      $transaction,
    } as never,
    userUpdateMany,
    outboxCreate,
    setNoOpFor(id: string) {
      updateManyResults.set(id, 0);
    },
  };
}

describe('expirePlans', () => {
  it('downgrades users whose planExpiresAt has passed and emits notification.plan_expired', async () => {
    const { prisma, userUpdateMany, outboxCreate } = makePrisma([
      { id: 'u1', planExpiresAt: new Date('2020-01-01') },
    ]);
    const result = await expirePlans({ prisma });
    expect(result).toEqual({ expired: 1 });
    expect(userUpdateMany).toHaveBeenCalledWith({
      where: { id: 'u1', plan: 'ESSENTIEL' },
      data: { plan: 'FREE', planExpiresAt: null },
    });
    expect(outboxCreate).toHaveBeenCalledOnce();
    expect(outboxCreate.mock.calls[0]![0].data.kind).toBe('notification.plan_expired');
  });

  it('is a no-op when no ESSENTIEL user has expired', async () => {
    const { prisma, outboxCreate } = makePrisma([]);
    const result = await expirePlans({ prisma });
    expect(result).toEqual({ expired: 0 });
    expect(outboxCreate).not.toHaveBeenCalled();
  });

  it('skips the outbox emit when a concurrent renewal already updated the row (updateMany count 0)', async () => {
    const { prisma, outboxCreate, setNoOpFor } = makePrisma([
      { id: 'u1', planExpiresAt: new Date('2020-01-01') },
    ]);
    setNoOpFor('u1');
    const result = await expirePlans({ prisma });
    expect(result).toEqual({ expired: 0 });
    expect(outboxCreate).not.toHaveBeenCalled();
  });
});
