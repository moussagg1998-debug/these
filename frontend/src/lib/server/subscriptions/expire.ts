// Downgrades ESSENTIEL users whose planExpiresAt has passed back to FREE.
// Mirrors orders/expire.ts's batching/idempotency shape.
import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { enqueueOutbox } from '../outbox';

export interface ExpirePlansOptions {
  prisma: PrismaClient;
  batchSize?: number; // default 100
}

export async function expirePlans(opts: ExpirePlansOptions): Promise<{ expired: number }> {
  const batchSize = opts.batchSize ?? 100;

  const candidates = await opts.prisma.user.findMany({
    where: { plan: 'ESSENTIEL', planExpiresAt: { lt: new Date() } },
    orderBy: { planExpiresAt: 'asc' },
    take: batchSize,
    select: { id: true, planExpiresAt: true },
  });

  if (candidates.length === 0) return { expired: 0 };

  let expired = 0;
  for (const u of candidates) {
    await opts.prisma.$transaction(async (tx) => {
      // plan='ESSENTIEL' WHERE-guard prevents racing with a renewal that
      // just extended planExpiresAt past `now`.
      const updated = await tx.user.updateMany({
        where: { id: u.id, plan: 'ESSENTIEL' },
        data: { plan: 'FREE', planExpiresAt: null },
      });
      if (updated.count === 0) return;
      await enqueueOutbox(tx, {
        kind: 'notification.plan_expired',
        payload: { userId: u.id, expiredAt: new Date().toISOString() },
      });
      expired++;
    });
  }
  return { expired };
}
