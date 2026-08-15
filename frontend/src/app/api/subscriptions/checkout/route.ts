// POST /api/subscriptions/checkout — start a Chariow checkout for the
// Essentiel plan, OR — when a valid `couponCode` is supplied — bypass
// Chariow entirely and activate the plan synchronously. Chariow's hosted
// checkout can't accept a per-transaction amount (see
// lib/server/payments/chariow.ts's header comment: price is always
// configured on their dashboard per product_id), so a coupon-covered
// checkout can't route through it — the Order is created directly PAID
// with provider "coupon" instead. Mirrors /api/orders' guard ordering
// (CSRF → auth → validation → provider lookup → PUBLIC_URL guard → DB
// write → charge) for the non-coupon path; the price/product are ALWAYS
// server-derived (subscriptions/plans.ts) — never taken from the request
// body, per spec's anti-tampering requirement ("un utilisateur ne peut pas
// modifier lui-même son plan").
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { log } from '@/lib/server/observability/log';
import { prisma } from '@/lib/server/prisma';
import { CircuitOpenError } from '@/lib/server/payments/circuit-breaker';
import {
  getChariowProvider,
  chariowBreaker,
  ChariowProviderUnconfiguredError,
} from '@/lib/server/payments/chariow-singleton';
import { resolveChariowPhone } from '@/lib/server/subscriptions/phone';
import { lockSubscriptionTx, lockCouponTx } from '@/lib/server/subscriptions/lock';
import { expectedPriceFcfa } from '@/lib/server/subscriptions/plans';
import {
  normalizeCouponCode,
  validateCoupon,
  computeDiscountedAmount,
  type CouponValidationError,
} from '@/lib/server/subscriptions/coupons';
import { activatePlanFromOrder } from '@/lib/server/subscriptions/activate';

const Body = z.object({
  plan: z.literal('ESSENTIEL'),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(1).max(30),
  phoneCountry: z.string().trim().length(2),
  // No .min(1): `resolveChariowPhone` treats phoneLocal as optional/nullable
  // (its 4-tier fallback chain — see subscriptions/phone.ts) and falls back
  // to `phone` or the African-dial-code table when it's empty. Rejecting an
  // empty phoneLocal here at the Zod layer would short-circuit to the
  // generic VALIDATION_FAILED instead of the more specific PHONE_INVALID
  // that resolveChariowPhone's null return produces.
  phoneLocal: z.string().trim().max(30),
  // Optional — same request shape whether or not a coupon is applied. The
  // coupon path below ignores firstName/lastName/phone*; those fields exist
  // to keep the client form identical either way (UpgradeModal.tsx).
  couponCode: z.string().trim().min(1).max(40).optional(),
});

// Chariow.md §9 default (MOBILE_MONEY_EXPIRE_HOURS) — the generic
// order-expiration cron sweeps any PENDING Order past this with no
// provider-specific code needed.
const ORDER_EXPIRY_MS = 2 * 60 * 60 * 1000;

/** Sentinel thrown from inside the transaction to short-circuit to 503 PAYMENT_IN_FLIGHT. */
class SubscriptionInFlightError extends Error {}

/** Sentinel thrown from inside the coupon transaction to short-circuit to 422 + the validation reason. */
class CouponValidationFailedError extends Error {
  constructor(public readonly reason: CouponValidationError) {
    super(reason);
  }
}

type CheckoutTxClient = Pick<Prisma.TransactionClient, 'order'>;

/**
 * Guards a user's checkout slot against a still-live Chariow attempt.
 * Shared by both branches below: without this, a coupon redemption could
 * leave an abandoned-but-still-completable Chariow PENDING order sitting
 * around — if the user (or a stale tab) later finished that checkout, the
 * webhook would credit a second time on top of the coupon's synchronous
 * activation, extending the plan by another paid period for free.
 */
async function supersedeInFlightChariowOrder(tx: CheckoutTxClient, userId: string): Promise<void> {
  const existing = await tx.order.findFirst({
    where: { userId, provider: 'chariow', status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });
  if (!existing) return;
  // WR-01-equivalent (see /api/orders) — a still-in-flight prior attempt
  // (crashed between its own tx commit and its charge() return) must not
  // be silently superseded.
  if (!existing.paymentUrl) {
    throw new SubscriptionInFlightError();
  }
  await tx.order.update({
    where: { id: existing.id },
    data: {
      status: 'FAILED',
      metadata: {
        ...((existing.metadata as Record<string, unknown> | null) ?? {}),
        cancelledReason: 'superseded',
      } as Prisma.InputJsonValue,
    },
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_FAILED',
          message: 'Invalid request body',
          issues: parsed.error.issues,
        },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const userId = auth.user.sub;
    const price = expectedPriceFcfa('ESSENTIEL');

    // ── Coupon-covered checkout — bypasses Chariow entirely ──
    if (parsed.data.couponCode) {
      const code = normalizeCouponCode(parsed.data.couponCode);

      let outcome;
      try {
        outcome = await prisma.$transaction(
          async (tx) => {
            await lockSubscriptionTx(tx, userId);
            await supersedeInFlightChariowOrder(tx, userId);
            await lockCouponTx(tx, code);

            const validation = await validateCoupon(tx, code, userId);
            if (!validation.ok) throw new CouponValidationFailedError(validation.error);

            const finalAmount = computeDiscountedAmount(price, validation.coupon.discountPercent);

            const order = await tx.order.create({
              data: {
                userId,
                amount: finalAmount,
                currency: 'XOF',
                provider: 'coupon',
                status: 'PAID',
                paidAt: new Date(),
                // No real "pending" window for a synchronously-resolved
                // coupon order — `expiresAt` is required by the schema but
                // unused for anything but PENDING rows (the order-expiration
                // cron only sweeps status: PENDING).
                expiresAt: new Date(),
                customerEmail: auth.user.email,
                metadata: {
                  plan: 'ESSENTIEL',
                  couponCode: validation.coupon.code,
                  originalAmount: price,
                  discountPercent: validation.coupon.discountPercent,
                },
              },
            });

            await tx.couponRedemption.create({
              data: { couponId: validation.coupon.id, userId, orderId: order.id },
            });

            const { planExpiresAt } = await activatePlanFromOrder(tx, {
              userId,
              orderId: order.id,
              plan: 'ESSENTIEL',
            });

            return {
              orderId: order.id,
              coupon: {
                code: validation.coupon.code,
                discountPercent: validation.coupon.discountPercent,
                originalAmount: price,
                finalAmount,
              },
              planExpiresAt,
            };
          },
          // lockCouponTx is keyed by coupon code, not per-user, so a promo
          // blast serializes many concurrent redeemers behind this one
          // transaction — matches the Serializable convention every other
          // advisory-lock-guarded money-path transaction in this codebase
          // uses (withdrawals/route.ts, admin/withdrawals/[id]/cancel,
          // subscriptions/reconcile.ts). Timeout widened to match
          // reconcile.ts's own fix for the exact bug class this reopens
          // (commit 29630b6): Prisma's 5s default is too tight once a
          // transaction can block behind other holders of the *same*
          // code-scoped lock during a burst of redemptions.
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            timeout: 35_000,
          },
        );
      } catch (err) {
        if (err instanceof CouponValidationFailedError) {
          return NextResponse.json(
            { error: err.reason, message: 'Coupon invalide ou déjà utilisé' },
            { status: 422, headers: { 'x-request-id': ctx.requestId } },
          );
        }
        if (err instanceof SubscriptionInFlightError) {
          return NextResponse.json(
            {
              error: 'PAYMENT_IN_FLIGHT',
              message: 'Prior attempt did not complete; retry shortly.',
            },
            { status: 503, headers: { 'x-request-id': ctx.requestId, 'Retry-After': '5' } },
          );
        }
        const code =
          typeof err === 'object' && err !== null && 'code' in err
            ? (err as { code: unknown }).code
            : undefined;
        // P2034 — Serializable isolation aborted because another redeemer
        // of the same code committed concurrently (see reconcile.ts's
        // identical reasoning for why this is a benign, expected race, not
        // a real failure). P2028 — the transaction itself timed out, which
        // can happen while blocked on the code-scoped lock behind another
        // redeemer. Both are retryable: the client can safely resubmit.
        if (code === 'P2034' || code === 'P2028') {
          return NextResponse.json(
            {
              error: 'COUPON_REDEMPTION_CONFLICT',
              message: 'Une autre tentative est en cours pour ce code promo. Réessayez.',
            },
            { status: 503, headers: { 'x-request-id': ctx.requestId, 'Retry-After': '3' } },
          );
        }
        // P2002 — the schema's @@unique([couponId, userId]) backstop fired.
        // The lock should make this unreachable in the common case, but a
        // stale-snapshot redeemer that unblocks after another commits (see
        // reconcile.ts:86-96 for the identical SSI reasoning) can still hit
        // it — surface the same COUPON_ALREADY_USED a pre-check would have.
        if (code === 'P2002') {
          return NextResponse.json(
            { error: 'COUPON_ALREADY_USED', message: 'Vous avez déjà utilisé ce code promo.' },
            { status: 422, headers: { 'x-request-id': ctx.requestId } },
          );
        }
        throw err;
      }

      return NextResponse.json(
        {
          orderId: outcome.orderId,
          paymentUrl: null,
          coupon: outcome.coupon,
          plan: 'ESSENTIEL',
          planExpiresAt: outcome.planExpiresAt.toISOString(),
        },
        { status: 201, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    // ── Existing Chariow flow, unchanged below ──
    if (!resolveChariowPhone(parsed.data)) {
      return NextResponse.json(
        { error: 'PHONE_INVALID', message: 'Invalid phone number' },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    let provider;
    try {
      provider = getChariowProvider();
    } catch (err) {
      if (err instanceof ChariowProviderUnconfiguredError) {
        return NextResponse.json(
          { error: 'PAYMENT_PROVIDER_UNCONFIGURED', message: 'Payment provider not configured' },
          { status: 503, headers: { 'x-request-id': ctx.requestId } },
        );
      }
      throw err;
    }

    const envPublicUrl = process.env.PUBLIC_URL;
    if (!envPublicUrl && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'PAYMENT_PROVIDER_UNCONFIGURED', message: 'PUBLIC_URL not set' },
        { status: 503, headers: { 'x-request-id': ctx.requestId } },
      );
    }
    const publicUrl = envPublicUrl ?? 'http://localhost:3000';

    let order;
    try {
      order = await prisma.$transaction(async (tx) => {
        await lockSubscriptionTx(tx, userId);
        await supersedeInFlightChariowOrder(tx, userId);

        return tx.order.create({
          data: {
            userId,
            amount: price,
            currency: 'XOF',
            provider: 'chariow',
            status: 'PENDING',
            expiresAt: new Date(Date.now() + ORDER_EXPIRY_MS),
            customerEmail: auth.user.email,
            customerPhone: parsed.data.phone,
            customerName: `${parsed.data.firstName} ${parsed.data.lastName}`,
            metadata: { plan: 'ESSENTIEL', phoneCountry: parsed.data.phoneCountry },
          },
        });
      });
    } catch (err) {
      if (err instanceof SubscriptionInFlightError) {
        return NextResponse.json(
          { error: 'PAYMENT_IN_FLIGHT', message: 'Prior attempt did not complete; retry shortly.' },
          { status: 503, headers: { 'x-request-id': ctx.requestId, 'Retry-After': '5' } },
        );
      }
      throw err;
    }

    let result;
    try {
      result = await chariowBreaker.execute(() =>
        provider.charge({
          amount: price,
          currency: 'XOF',
          customer: {
            email: auth.user.email,
            firstName: parsed.data.firstName,
            lastName: parsed.data.lastName,
            phone: parsed.data.phone,
            phoneCountry: parsed.data.phoneCountry,
            phoneLocal: parsed.data.phoneLocal,
          },
          metadata: { plan: 'ESSENTIEL' },
          successUrl: `${publicUrl}/subscribe/return?orderId=${order.id}`,
          failureUrl: `${publicUrl}/subscribe/return?orderId=${order.id}&status=failed`,
          externalRef: order.id,
        }),
      );
    } catch (err) {
      if (err instanceof CircuitOpenError) {
        await prisma.order.update({ where: { id: order.id }, data: { status: 'FAILED' } });
        const retryAfterSec = Math.max(1, Math.ceil((err.retryAt.getTime() - Date.now()) / 1000));
        return NextResponse.json(
          {
            error: 'PAYMENT_PROVIDER_UNAVAILABLE',
            message: 'Payment provider temporarily unavailable. Try again shortly.',
          },
          {
            status: 503,
            headers: { 'x-request-id': ctx.requestId, 'Retry-After': String(retryAfterSec) },
          },
        );
      }
      await prisma.order.update({ where: { id: order.id }, data: { status: 'FAILED' } });
      const message = err instanceof Error ? err.message : 'Unknown payment error';
      return NextResponse.json(
        { error: 'PAYMENT_FAILED', message },
        { status: 502, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    // Chariow has already created a real, live checkout session at this
    // point (`result.providerChargeId` is a real charge on their side). If
    // persisting that reference fails here, we must NOT mark the Order
    // FAILED — doing so would let a user retry sail past the
    // PAYMENT_IN_FLIGHT guard (which only trips on a PENDING order with no
    // paymentUrl) and create a second, disconnected Chariow session,
    // orphaning the first one with no providerChargeId on record anywhere
    // to reconcile it later. Leaving status PENDING with paymentUrl still
    // null is what makes the retry correctly hit PAYMENT_IN_FLIGHT instead.
    try {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          providerChargeId: result.providerChargeId,
          paymentUrl: result.paymentUrl,
          // Order.amount is an Int column — an unrounded provider amount
          // throws here, which (correctly) does NOT mark the order FAILED
          // (see the catch below), leaving it wedged behind
          // PAYMENT_IN_FLIGHT for the full 2h expiry with an orphaned live
          // Chariow session. Round defensively rather than trust the
          // provider response to already be an integer.
          amount: Math.round(result.amount ?? price),
          currency: result.currency ?? 'XOF',
        },
      });
    } catch (err) {
      log.error('subscriptions/checkout: post-charge Order update failed', {
        orderId: order.id,
        providerChargeId: result.providerChargeId,
        err: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        { error: 'PAYMENT_FAILED', message: 'Failed to persist payment reference' },
        { status: 502, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    return NextResponse.json(
      { orderId: order.id, paymentUrl: result.paymentUrl },
      { status: 201, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
