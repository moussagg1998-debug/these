/**
 * Shared plan-activation logic — extracted from reconcile.ts so the coupon
 * checkout path (subscriptions/coupons.ts + api/subscriptions/checkout)
 * credits a plan identically to a real Chariow payment: same "extend from
 * current expiry if still active, else from now" rule, same notification.
 */
import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { enqueueOutbox } from '../outbox';
import { planDurationDays, type PlanId } from './plans';

export type ActivateTxClient = Pick<PrismaClient, 'user' | 'outboxEvent'>;

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function activatePlanFromOrder(
  tx: ActivateTxClient,
  input: { userId: string; orderId: string; plan: PlanId },
): Promise<{ planExpiresAt: Date }> {
  const user = await tx.user.findUnique({
    where: { id: input.userId },
    select: { planExpiresAt: true },
  });
  const now = new Date();
  const base = user?.planExpiresAt && user.planExpiresAt > now ? user.planExpiresAt : now;
  const planExpiresAt = addDays(base, planDurationDays(input.plan));

  await tx.user.update({
    where: { id: input.userId },
    data: { plan: input.plan, planExpiresAt },
  });

  await enqueueOutbox(tx, {
    kind: 'notification.plan_activated',
    payload: {
      userId: input.userId,
      orderId: input.orderId,
      plan: input.plan,
      expiresAt: planExpiresAt.toISOString(),
    },
  });

  return { planExpiresAt };
}
