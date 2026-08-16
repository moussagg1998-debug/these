/**
 * Postgres advisory lock for subscription checkout creation — same
 * `pg_advisory_xact_lock(hashtext(...))` technique as
 * `withdrawals/lock.ts`, but with a namespaced key
 * (`subscription:${userId}`) so it never shares a lock slot with the
 * withdrawal flow. Held for the surrounding transaction's duration; released
 * automatically on commit/rollback. Serializes two rapid clicks on "Passer
 * au plan Essentiel" from the same user so they can't create two PENDING
 * Chariow orders concurrently.
 */
import type { Prisma } from '@prisma/client';

// Narrowed to exactly what this function uses (`$executeRawUnsafe`) rather
// than the full transaction client, so callers whose own tx type is a
// smaller Pick (e.g. subscriptions/reconcile.ts's `ReconcileTxClient`) don't
// need an unsound cast to pass their `tx` through.
export type SubscriptionTxClient = Pick<Prisma.TransactionClient, '$executeRawUnsafe'>;

export async function lockSubscriptionTx(tx: SubscriptionTxClient, userId: string): Promise<void> {
  await tx.$executeRawUnsafe(
    'SELECT pg_advisory_xact_lock(hashtext($1))',
    `subscription:${userId}`,
  );
}

/**
 * Advisory lock scoped to a coupon CODE (not id — no lookup needed before
 * locking). Serializes every redemption of the same coupon against each
 * other, regardless of which user is redeeming, so `Coupon.maxRedemptions`
 * is exact under concurrency: two different users redeeming the same coupon
 * at once still can't both slip in under the cap. Always taken AFTER
 * `lockSubscriptionTx` in the checkout route (see subscriptions/coupons.ts)
 * — one canonical lock order avoids any deadlock risk between the two.
 */
export async function lockCouponTx(tx: SubscriptionTxClient, code: string): Promise<void> {
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `coupon:${code}`);
}
