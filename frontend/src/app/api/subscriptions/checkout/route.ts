// POST /api/subscriptions/checkout — start a Chariow checkout for the
// Essentiel plan. Mirrors /api/orders' guard ordering (CSRF → auth →
// validation → provider lookup → PUBLIC_URL guard → DB write → charge)
// but the price/product are ALWAYS server-derived (subscriptions/plans.ts)
// — never taken from the request body, per spec's anti-tampering
// requirement ("un utilisateur ne peut pas modifier lui-même son plan").
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
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
import { lockSubscriptionTx } from '@/lib/server/subscriptions/lock';
import { expectedPriceFcfa } from '@/lib/server/subscriptions/plans';

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
});

// Chariow.md §9 default (MOBILE_MONEY_EXPIRE_HOURS) — the generic
// order-expiration cron sweeps any PENDING Order past this with no
// provider-specific code needed.
const ORDER_EXPIRY_MS = 2 * 60 * 60 * 1000;

/** Sentinel thrown from inside the transaction to short-circuit to 503 PAYMENT_IN_FLIGHT. */
class SubscriptionInFlightError extends Error {}

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

    const price = expectedPriceFcfa('ESSENTIEL');
    const userId = auth.user.sub;

    let order;
    try {
      order = await prisma.$transaction(async (tx) => {
        await lockSubscriptionTx(tx, userId);

        const existing = await tx.order.findFirst({
          where: { userId, provider: 'chariow', status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
        });
        if (existing) {
          // WR-01-equivalent (see /api/orders) — a still-in-flight prior
          // attempt (crashed between its own tx commit and its charge()
          // return) must not be silently superseded.
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
