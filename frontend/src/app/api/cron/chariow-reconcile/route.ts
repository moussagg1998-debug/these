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

/**
 * Rotate a still-unresolved order to the back of the next `updatedAt`-ordered
 * batch. `reconcileChariowOrder` writes nothing when it can't conclude (remote
 * still processing, amount anomaly, thrown pull), so without this the same
 * rows would sort first forever.
 *
 * Deliberately PENDING-only: FAILED/EXPIRED candidates are selected by
 * `updatedAt >= since`, so bumping those would pin every dead order inside the
 * catch-up window permanently instead of letting it age out after
 * CHARIOW_RECONCILE_CATCHUP_DAYS. The `status: 'PENDING'` WHERE-guard makes
 * this a no-op on a row a webhook just flipped to PAID.
 */
async function touch(order: { id: string; status: string }): Promise<void> {
  if (order.status !== 'PENDING') return;
  try {
    await prisma.order.updateMany({
      where: { id: order.id, status: 'PENDING' },
      data: { updatedAt: new Date() },
    });
  } catch (err) {
    // Best-effort fairness nudge — never worth failing a tick over.
    log.warn('chariow-reconcile: updatedAt touch failed', {
      orderId: order.id,
      err: err instanceof Error ? err.message : String(err),
    });
  }
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
          // Without a Chariow sale reference there is nothing to re-pull, so
          // such an order can never be credited — e.g. a checkout abandoned
          // before charge() ever returned. (A *superseded* order — the user
          // re-clicked "upgrade", or redeemed a coupon, while a prior order
          // was still PENDING with a live paymentUrl — DOES carry a
          // providerChargeId; `reconcileChariowOrderCore` refuses to
          // re-verify those via their `cancelledReason: 'superseded'`
          // metadata stamp instead, not via this filter.) Rows with no
          // charge reference are the oldest and used to sort to the front
          // of every batch, crowding out real work.
          providerChargeId: { not: null },
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
        // `updatedAt`, not `createdAt`: combined with the touch below, an
        // order that keeps coming back without resolving rotates to the back
        // of the next batch instead of permanently occupying the front.
        orderBy: { updatedAt: 'asc' },
        take: BATCH_SIZE,
      });

      let failed = 0;
      for (const order of candidates) {
        try {
          const outcome = await reconcileChariowOrder({ prisma, order, provider });
          if (outcome !== 'PAID') await touch(order);
        } catch (err) {
          // One unreconcilable order (e.g. Chariow 404s a deleted sale) must
          // not take the rest of the batch down with it — and because the
          // batch is ordered by `updatedAt`, an un-touched thrower would sort
          // first again on the very next tick, stalling the queue rather than
          // being skipped once.
          failed++;
          log.error('chariow-reconcile: order failed to reconcile', {
            orderId: order.id,
            requestId: ctx.requestId,
            err: err instanceof Error ? err.message : String(err),
          });
          await touch(order);
        }
        processed++;
      }
      log.info('chariow-reconcile tick', { processed, failed, requestId: ctx.requestId });
    });

    return NextResponse.json(
      { ok: true, processed },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
