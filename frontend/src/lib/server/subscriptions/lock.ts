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
