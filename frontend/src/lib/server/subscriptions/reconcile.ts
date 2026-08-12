/**
 * Chariow fulfilment core — the ONLY place that ever flips
 * `Order.status = 'PAID'` or credits `User.plan`. Called from three
 * independent, idempotent paths (webhook, user-return poll, 5-minute
 * cron) — all converge here so none of them can double-credit.
 *
 * Chariow.md invariants honored:
 *   §5.2 / §11.4 — never credit on the webhook body alone; always re-pull
 *     GET /sales/{id} first.
 *   §5.3 / §11.3 — succeededAt/paidAt comes from the provider's own date,
 *     falling back to Order.createdAt — NEVER `new Date()` on a catch-up.
 *   §5.4 — amount anti-fraude, 5% tolerance against the configured plan
 *     price; a mismatch logs a warning and credits nothing.
 *   §5.2 — idempotence via `updateMany` guarded on
 *     `status IN (PENDING, FAILED)`; a `count === 0` result means another
 *     concurrent reconcile already won — treated as success, not an error.
 */
import 'server-only';
import type { PrismaClient, Order } from '@prisma/client';
import { createLogger } from '../logger';
import { enqueueOutbox } from '../outbox';
import { mapChariowStatus } from '../payments/chariow';
import type { ChariowProviderHandle } from '../payments/chariow';
import { expectedPriceFcfa, planDurationDays, type PlanId } from './plans';

const logger = createLogger();

const AMOUNT_TOLERANCE = 0.05;

export type ReconcileOutcome = 'PAID' | 'PENDING' | 'FAILED';

export type ReconcileTxClient = Pick<PrismaClient, 'order' | 'user' | 'outboxEvent'>;

function amountWithinTolerance(actual: number, expected: number): boolean {
  if (expected === 0) return actual === 0;
  return Math.abs(actual - expected) / expected <= AMOUNT_TOLERANCE;
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * No `$transaction` call of its own — callable either inside the webhook
 * factory's existing transaction (pass its `tx` straight through) or inside
 * a fresh one opened by `reconcileChariowOrder` below.
 */
export async function reconcileChariowOrderCore(
  tx: ReconcileTxClient,
  order: Order,
  provider: Pick<ChariowProviderHandle, 'getSaleStatus'>,
  opts: { pullTimeoutMs?: number } = {},
): Promise<ReconcileOutcome> {
  if (order.status === 'PAID') return 'PAID';
  if (order.status !== 'PENDING' && order.status !== 'FAILED') {
    // EXPIRED / REFUNDED — terminal states this function does not revisit.
    return 'FAILED';
  }
  if (!order.providerChargeId) return 'PENDING';

  const remote = await provider.getSaleStatus(order.providerChargeId, {
    ...(opts.pullTimeoutMs !== undefined ? { timeoutMs: opts.pullTimeoutMs } : {}),
  });
  const mapped = mapChariowStatus(remote.status);

  if (mapped === 'pending') return 'PENDING';

  if (mapped === 'failed' || mapped === 'abandoned') {
    if (order.status !== 'FAILED') {
      await tx.order.updateMany({
        where: { id: order.id, status: { in: ['PENDING', 'FAILED'] } },
        data: { status: 'FAILED' },
      });
    }
    return 'FAILED';
  }

  // mapped === 'succeeded'
  const plan = (order.metadata as { plan?: string } | null)?.plan;
  if (plan !== 'ESSENTIEL') {
    logger.error('[Chariow] Order has no recognized plan in metadata — NOT credited', {
      orderId: order.id,
    });
    return 'PENDING';
  }

  const expected = expectedPriceFcfa(plan as PlanId);
  if (!amountWithinTolerance(remote.amount.value, expected)) {
    logger.warn('[Chariow] ANOMALIE montant — NON crédité', {
      orderId: order.id,
      expected,
      actual: remote.amount.value,
      currency: remote.amount.currency,
    });
    return 'PENDING';
  }

  const updated = await tx.order.updateMany({
    where: { id: order.id, status: { in: ['PENDING', 'FAILED'] } },
    data: { status: 'PAID', paidAt: remote.paidAt ?? order.createdAt },
  });
  if (updated.count === 0) {
    // Another concurrent reconcile already flipped this order — idempotent no-op.
    return 'PAID';
  }

  if (!order.userId) return 'PAID'; // guest order — nothing to credit (should not occur for subscriptions)

  const user = await tx.user.findUnique({
    where: { id: order.userId },
    select: { planExpiresAt: true },
  });
  const now = new Date();
  const base = user?.planExpiresAt && user.planExpiresAt > now ? user.planExpiresAt : now;
  const newExpiry = addDays(base, planDurationDays(plan as PlanId));

  await tx.user.update({
    where: { id: order.userId },
    data: { plan, planExpiresAt: newExpiry },
  });

  await enqueueOutbox(tx, {
    kind: 'notification.plan_activated',
    payload: { userId: order.userId, orderId: order.id, plan, expiresAt: newExpiry.toISOString() },
  });

  return 'PAID';
}

/**
 * Wrapper for callers OUTSIDE an existing transaction (the `verify` route,
 * the reconciliation cron) — opens its own Serializable transaction and
 * delegates to the core above.
 */
export async function reconcileChariowOrder(opts: {
  prisma: PrismaClient;
  order: Order;
  provider: Pick<ChariowProviderHandle, 'getSaleStatus'>;
}): Promise<ReconcileOutcome> {
  if (opts.order.status === 'PAID') return 'PAID';
  return opts.prisma.$transaction(
    (tx) =>
      reconcileChariowOrderCore(tx as unknown as ReconcileTxClient, opts.order, opts.provider),
    { isolationLevel: 'Serializable' },
  );
}
