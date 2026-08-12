// POST /api/subscriptions/verify — polled by the /subscribe/return page.
// NEVER concludes from URL params alone; always re-runs reconciliation
// (which itself re-pulls Chariow's GET /sales/{id} before trusting anything).
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { prisma } from '@/lib/server/prisma';
import {
  getChariowProvider,
  ChariowProviderUnconfiguredError,
} from '@/lib/server/payments/chariow-singleton';
import { reconcileChariowOrder } from '@/lib/server/subscriptions/reconcile';

const Body = z.object({ orderId: z.string().trim().min(1).optional() });

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    // Unlike `status` (a CSRF-free GET), this POST can trigger
    // `reconcileChariowOrder`'s DB writes (Order -> PAID, User.plan credit)
    // and an outbound Chariow API call — CSRF-protect it like `checkout`.
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: 'Invalid request body' },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const order = parsed.data.orderId
      ? await prisma.order.findUnique({ where: { id: parsed.data.orderId } })
      : await prisma.order.findFirst({
          where: { userId: auth.user.sub, provider: 'chariow' },
          orderBy: { createdAt: 'desc' },
        });

    if (!order || order.userId !== auth.user.sub || order.provider !== 'chariow') {
      return NextResponse.json(
        { error: 'ORDER_NOT_FOUND', message: 'Order not found' },
        { status: 404, headers: { 'x-request-id': ctx.requestId } },
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

    let status: Awaited<ReturnType<typeof reconcileChariowOrder>>;
    try {
      status = await reconcileChariowOrder({ prisma, order, provider });
    } catch (err) {
      // P2034 — Serializable isolation aborted because the webhook (holding
      // the same advisory lock) committed a credit concurrently. This poller
      // retries every 3s regardless, so surface a plain PENDING rather than
      // a 500 for what is an expected, benign race, not a real failure.
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: unknown }).code === 'P2034'
      ) {
        status = 'PENDING';
      } else {
        throw err;
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.user.sub },
      select: { plan: true, planExpiresAt: true },
    });

    return NextResponse.json(
      { status, plan: user?.plan ?? 'FREE', planExpiresAt: user?.planExpiresAt ?? null },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
