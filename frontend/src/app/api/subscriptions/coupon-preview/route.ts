// GET /api/subscriptions/coupon-preview — read-only coupon check, so the
// UpgradeModal can show "5900 → -95% → 295 FCFA" before the user commits to
// checkout. Never authoritative: POST /api/subscriptions/checkout revalidates
// everything inside its own lock — same never-trust-the-preview principle as
// /api/subscriptions/verify never trusting its URL params.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/server/middleware';
import { enforceCouponPreviewRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { prisma } from '@/lib/server/prisma';
import {
  normalizeCouponCode,
  validateCoupon,
  computeDiscountedAmount,
} from '@/lib/server/subscriptions/coupons';
import { expectedPriceFcfa } from '@/lib/server/subscriptions/plans';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceCouponPreviewRateLimit(auth.user.sub);
    if (limited) return limited;

    const raw = req.nextUrl.searchParams.get('code') ?? '';
    if (!raw.trim()) {
      return NextResponse.json(
        { valid: false, reason: 'COUPON_NOT_FOUND' },
        { headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const code = normalizeCouponCode(raw);
    const result = await validateCoupon(prisma, code, auth.user.sub);

    if (!result.ok) {
      return NextResponse.json(
        { valid: false, reason: result.error },
        { headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const originalAmount = expectedPriceFcfa('ESSENTIEL');
    const finalAmount = computeDiscountedAmount(originalAmount, result.coupon.discountPercent);

    return NextResponse.json(
      {
        valid: true,
        code: result.coupon.code,
        discountPercent: result.coupon.discountPercent,
        originalAmount,
        finalAmount,
      },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
