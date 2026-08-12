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
 *     `status IN (PENDING, FAILED, EXPIRED)`; a `count === 0` result means
 *     another concurrent reconcile already won — treated as success, not an
 *     error.
 *
 * EXPIRED is deliberately re-checkable: checkout stamps `expiresAt` 2h out and
 * the generic `order-expiration` cron flips any still-PENDING order past that
 * deadline. A mobile-money settlement (or a webhook retry) landing after that
 * window would otherwise hit a terminal state and be dropped on the floor —
 * losing a plan credit the customer actually paid for. Widening the *local*
 * eligibility does not weaken any verification: the remote `GET /sales/{id}`
 * re-pull, the plan-metadata check and the amount anti-fraude guard all still
 * have to pass before anything is credited.
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

/**
 * Local order states this function is still willing to re-verify against
 * Chariow. Doubles as the `updateMany` status guard so a concurrent reconcile
 * that already moved the row loses the write (`count === 0`) instead of
 * double-crediting.
 */
export const RECHECKABLE_STATUSES = ['PENDING', 'FAILED', 'EXPIRED'] as const;

function isRecheckable(status: string): boolean {
  return (RECHECKABLE_STATUSES as readonly string[]).includes(status);
}

/** Fresh array per call — Prisma's `in` filter expects a mutable `string[]`. */
function recheckableWhere(orderId: string) {
  return { id: orderId, status: { in: [...RECHECKABLE_STATUSES] } };
}

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
  if (!isRecheckable(order.status)) {
    // REFUNDED (or any future state) — genuinely terminal, this function will
    // not revisit it. Never return 'FAILED' from here silently: an operator
    // has to be able to see that a Chariow event landed on an order we
    // refused to re-verify.
    logger.error('[Chariow] Order in a terminal state — reconciliation skipped, NOT re-pulled', {
      orderId: order.id,
      status: order.status,
    });
    return 'FAILED';
  }
  if (!order.providerChargeId) return 'PENDING';

  const remote = await provider.getSaleStatus(order.providerChargeId, {
    ...(opts.pullTimeoutMs !== undefined ? { timeoutMs: opts.pullTimeoutMs } : {}),
  });
  const mapped = mapChariowStatus(remote.status);

  if (mapped === 'pending') return 'PENDING';

  if (mapped === 'failed' || mapped === 'abandoned') {
    // Only PENDING is worth writing down. An already-FAILED row needs no
    // write, and an EXPIRED one is deliberately left EXPIRED: rewriting it
    // would both erase why it closed and bump `updatedAt`, restarting the
    // cron's `CHARIOW_RECONCILE_CATCHUP_DAYS` window on a dead order.
    if (order.status === 'PENDING') {
      await tx.order.updateMany({
        where: recheckableWhere(order.id),
        data: { status: 'FAILED' },
      });
    }
    return 'FAILED';
  }

  if (mapped !== 'succeeded') {
    // Defensive guard — mapChariowStatus's return union currently only has
    // 4 literals and the other 3 are handled above, so this should never
    // trigger today. Protects against silently crediting a plan if that
    // union is ever widened with a 5th value without updating this file.
    logger.error('[Chariow] Unexpected mapped status reached credit path', {
      orderId: order.id,
      mapped,
    });
    return 'PENDING';
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
    where: recheckableWhere(order.id),
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
