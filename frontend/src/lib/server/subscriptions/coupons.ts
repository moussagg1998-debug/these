/**
 * Coupon validation — shared between the checkout route (authoritative,
 * called inside the `subscription:{userId}` + `coupon:{code}` advisory
 * locks — see subscriptions/lock.ts) and the read-only preview route
 * (best-effort, no lock). The checkout route is the only source of truth;
 * a preview returning `valid: true` does not guarantee the subsequent
 * checkout call succeeds (the coupon could be disabled or hit its cap in
 * between) — same never-trust-the-preview principle as
 * /api/subscriptions/verify never trusting its URL params.
 */
import 'server-only';
import type { Coupon, PrismaClient } from '@prisma/client';

export type CouponValidationError =
  | 'COUPON_NOT_FOUND'
  | 'COUPON_INACTIVE'
  | 'COUPON_EXPIRED'
  | 'COUPON_MAX_REDEMPTIONS'
  | 'COUPON_ALREADY_USED';

export type CouponValidationResult =
  | { ok: true; coupon: Coupon }
  | { ok: false; error: CouponValidationError };

export type CouponReadClient = Pick<PrismaClient, 'coupon' | 'couponRedemption'>;

export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * `Order.amount` is an Int column — round defensively, same rule this
 * codebase already applies to other computed FCFA amounts
 * (checkout/route.ts's `Math.round(result.amount ?? price)`).
 */
export function computeDiscountedAmount(originalAmount: number, discountPercent: number): number {
  return Math.round((originalAmount * (100 - discountPercent)) / 100);
}

export async function validateCoupon(
  client: CouponReadClient,
  code: string,
  userId: string,
): Promise<CouponValidationResult> {
  const coupon = await client.coupon.findUnique({ where: { code } });
  if (!coupon) return { ok: false, error: 'COUPON_NOT_FOUND' };
  if (!coupon.isActive) return { ok: false, error: 'COUPON_INACTIVE' };
  if (coupon.expiresAt && coupon.expiresAt <= new Date()) {
    return { ok: false, error: 'COUPON_EXPIRED' };
  }
  if (coupon.maxRedemptions !== null) {
    const count = await client.couponRedemption.count({ where: { couponId: coupon.id } });
    if (count >= coupon.maxRedemptions) return { ok: false, error: 'COUPON_MAX_REDEMPTIONS' };
  }
  const already = await client.couponRedemption.findUnique({
    where: { couponId_userId: { couponId: coupon.id, userId } },
  });
  if (already) return { ok: false, error: 'COUPON_ALREADY_USED' };
  return { ok: true, coupon };
}
