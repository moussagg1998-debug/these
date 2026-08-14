import { describe, it, expect, vi } from 'vitest';
import { main } from './seed-coupon-thesis';

function makeMockPrisma() {
  const upsert = vi.fn(async (args: { create: Record<string, unknown> }) => ({
    id: 'coupon-1',
    ...args.create,
  }));
  return { coupon: { upsert }, $disconnect: vi.fn() };
}

describe('seed-coupon-thesis', () => {
  it('upserts THESIS at 95% discount, active, with update:{} so a re-run never resets admin edits', async () => {
    const prisma = makeMockPrisma();
    const code = await main({ prisma: prisma as never });
    expect(code).toBe(0);
    expect(prisma.coupon.upsert).toHaveBeenCalledWith({
      where: { code: 'THESIS' },
      create: { code: 'THESIS', discountPercent: 95, isActive: true },
      update: {},
    });
  });

  it('does not disconnect an injected prisma client (only the lazily-created one)', async () => {
    const prisma = makeMockPrisma();
    await main({ prisma: prisma as never });
    expect(prisma.$disconnect).not.toHaveBeenCalled();
  });
});
