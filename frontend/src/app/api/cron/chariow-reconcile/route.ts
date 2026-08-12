export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCronSecret } from '@/lib/server/cron/auth';
import { withLease } from '@/lib/server/leader-lease';
import { prisma } from '@/lib/server/prisma';
import { redis } from '@/lib/server/redis';
import { createLogger } from '@/lib/server/logger';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import {
  getChariowProvider,
  ChariowProviderUnconfiguredError,
} from '@/lib/server/payments/chariow-singleton';
import { reconcileChariowOrder } from '@/lib/server/subscriptions/reconcile';

const log = createLogger();
const LEASE_TTL_MS = 60_000;
const BATCH_SIZE = 50;

function catchupDays(): number {
  const raw = process.env.CHARIOW_RECONCILE_CATCHUP_DAYS;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 3;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const fail = verifyCronSecret(req);
  if (fail) return fail;

  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    let processed = 0;

    await withLease(redis ?? undefined, 'chariow-reconcile', LEASE_TTL_MS, async () => {
      let provider;
      try {
        provider = getChariowProvider();
      } catch (err) {
        if (err instanceof ChariowProviderUnconfiguredError) {
          log.warn('chariow-reconcile tick skipped — provider not configured');
          return;
        }
        throw err;
      }

      const since = new Date(Date.now() - catchupDays() * 24 * 60 * 60 * 1000);
      const candidates = await prisma.order.findMany({
        where: {
          provider: 'chariow',
          OR: [
            { status: 'PENDING' },
            { status: 'FAILED', updatedAt: { gte: since } },
            // A mobile-money settlement can land after checkout's 2h
            // `expiresAt`, by which point the generic `order-expiration` cron
            // has already flipped the row to EXPIRED. Without this branch that
            // late payment is never re-pulled and the customer silently loses
            // the plan they paid for. Same catch-up window as FAILED.
            { status: 'EXPIRED', updatedAt: { gte: since } },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: BATCH_SIZE,
      });

      for (const order of candidates) {
        await reconcileChariowOrder({ prisma, order, provider });
        processed++;
      }
      log.info('chariow-reconcile tick', { processed, requestId: ctx.requestId });
    });

    return NextResponse.json(
      { ok: true, processed },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
